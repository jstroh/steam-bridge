use super::JsCallback;
use napi::bindgen_prelude::{Error, FnArgs, Status};
use napi::threadsafe_function::{ThreadsafeFunction, ThreadsafeFunctionCallMode};
use serde_json::json;
use std::future::Future;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{mpsc, Arc, Mutex, OnceLock};
use std::thread::JoinHandle;
use std::time::Duration;
use tokio::sync::oneshot;

const OBJECT_PATH: &str = "/com/steambridge/OverlayHostSync";
const MAX_TOKEN_LENGTH: usize = 128;
const MAX_SOURCE_ID_LENGTH: usize = 128;
const MAX_PAIR_ID_LENGTH: usize = 128;
const MAX_JAVASCRIPT_SAFE_SEQUENCE: u64 = 9_007_199_254_740_991;
const MAX_PRESENTATION_EPOCH: u64 = u32::MAX as u64;
const MIN_GEOMETRY_COORDINATE: f64 = -2_147_483_648.0;
const MAX_GEOMETRY_COORDINATE: f64 = 2_147_483_647.0;
const MAX_GEOMETRY_SIZE: f64 = 2_147_483_647.0;

type WeakFatalThreadsafeFunction<T> = ThreadsafeFunction<T, (), FnArgs<(T,)>, Status, false, true>;

struct OverlayHostSyncEvents {
    token: String,
    handler: Arc<WeakFatalThreadsafeFunction<serde_json::Value>>,
}

struct ReceiverRuntime {
    stop: Option<oneshot::Sender<()>>,
    thread: Option<JoinHandle<()>>,
    running: Arc<AtomicBool>,
}

struct ReceiverRunningGuard(Arc<AtomicBool>);

impl Drop for ReceiverRunningGuard {
    fn drop(&mut self) {
        self.0.store(false, Ordering::Release);
    }
}

static RECEIVER_RUNTIME: OnceLock<Mutex<Option<ReceiverRuntime>>> = OnceLock::new();

fn receiver_runtime() -> &'static Mutex<Option<ReceiverRuntime>> {
    RECEIVER_RUNTIME.get_or_init(|| Mutex::new(None))
}

fn stop_runtime(mut runtime: ReceiverRuntime) {
    if let Some(stop) = runtime.stop.take() {
        let _ = stop.send(());
    }
    if let Some(thread) = runtime.thread.take() {
        let _ = thread.join();
    }
}

pub fn stop() {
    let mut runtime = receiver_runtime()
        .lock()
        .unwrap_or_else(|poisoned| poisoned.into_inner());
    if let Some(active) = runtime.take() {
        stop_runtime(active);
    }
}

pub fn is_running() -> bool {
    let runtime = receiver_runtime()
        .lock()
        .unwrap_or_else(|poisoned| poisoned.into_inner());
    runtime
        .as_ref()
        .is_some_and(|active| active.running.load(Ordering::Acquire))
}

async fn await_startup_or_stop<T>(
    stop: &mut oneshot::Receiver<()>,
    startup: impl Future<Output = T>,
) -> Option<T> {
    tokio::select! {
        _ = stop => None,
        value = startup => Some(value),
    }
}

#[derive(Clone, Copy)]
struct ValidatedGeometry {
    x: f64,
    y: f64,
    width: f64,
    height: f64,
}

fn parse_sequence(value: &str) -> Option<u64> {
    let sequence = value.parse::<u64>().ok()?;
    (sequence > 0 && sequence <= MAX_JAVASCRIPT_SAFE_SEQUENCE).then_some(sequence)
}

fn parse_presentation_epoch(value: &str) -> Option<u32> {
    let epoch = value.parse::<u64>().ok()?;
    (epoch <= MAX_PRESENTATION_EPOCH).then_some(epoch as u32)
}

fn parse_presentation_counter(value: &str) -> Option<u32> {
    let counter = value.parse::<u64>().ok()?;
    (counter > 0 && counter <= u32::MAX as u64).then_some(counter as u32)
}

fn parse_pair_generation(token: &str, pair_id: &str) -> Option<u32> {
    if pair_id.is_empty() || pair_id.len() > MAX_PAIR_ID_LENGTH {
        return None;
    }
    let suffix = pair_id.strip_prefix(token)?.strip_prefix(':')?;
    parse_presentation_counter(suffix)
}

fn parse_coordinate(value: &str) -> Option<f64> {
    let coordinate = value.parse::<f64>().ok()?;
    (coordinate.is_finite()
        && (MIN_GEOMETRY_COORDINATE..=MAX_GEOMETRY_COORDINATE).contains(&coordinate))
    .then_some(coordinate)
}

fn parse_size(value: &str) -> Option<f64> {
    let size = value.parse::<f64>().ok()?;
    (size.is_finite() && size > 0.0 && size <= MAX_GEOMETRY_SIZE).then_some(size)
}

fn parse_geometry(x: &str, y: &str, width: &str, height: &str) -> Option<ValidatedGeometry> {
    Some(ValidatedGeometry {
        x: parse_coordinate(x)?,
        y: parse_coordinate(y)?,
        width: parse_size(width)?,
        height: parse_size(height)?,
    })
}

fn parse_geometry_tuple(value: &str) -> Option<ValidatedGeometry> {
    let mut parts = value.split(',');
    let geometry = parse_geometry(parts.next()?, parts.next()?, parts.next()?, parts.next()?)?;
    parts.next().is_none().then_some(geometry)
}

#[zbus::interface(name = "com.steambridge.OverlayHostSync", spawn = false)]
impl OverlayHostSyncEvents {
    fn notify_resize_state(
        &self,
        token: &str,
        source_id: &str,
        sequence: &str,
        paired: bool,
        active: bool,
    ) -> bool {
        if token != self.token
            || source_id.is_empty()
            || source_id.len() > MAX_SOURCE_ID_LENGTH
            || (active && !paired)
        {
            return false;
        }
        let Some(sequence) = parse_sequence(sequence) else {
            return false;
        };
        self.handler.call(
            json!({
                "kind": "resizeState",
                "sourceId": source_id,
                "sequence": sequence,
                "paired": paired,
                "active": active,
            }),
            ThreadsafeFunctionCallMode::NonBlocking,
        ) == Status::Ok
    }

    #[allow(clippy::too_many_arguments)]
    fn notify_presentation_state(
        &self,
        token: &str,
        pair_id: &str,
        sequence: &str,
        epoch: &str,
        full_screen: bool,
        source_geometry: &str,
        target_geometry: &str,
    ) -> bool {
        if token != self.token || parse_pair_generation(&self.token, pair_id).is_none() {
            return false;
        }
        let Some(sequence) = parse_presentation_counter(sequence) else {
            return false;
        };
        let Some(epoch) = parse_presentation_epoch(epoch) else {
            return false;
        };
        let Some(source_bounds) = parse_geometry_tuple(source_geometry) else {
            return false;
        };
        let Some(target) = parse_geometry_tuple(target_geometry) else {
            return false;
        };
        self.handler.call(
            json!({
                "kind": "presentationState",
                "pairId": pair_id,
                "sequence": sequence,
                "epoch": epoch,
                "fullScreen": full_screen,
                "sourceBounds": {
                    "x": source_bounds.x,
                    "y": source_bounds.y,
                    "width": source_bounds.width,
                    "height": source_bounds.height,
                },
                "target": {
                    "x": target.x,
                    "y": target.y,
                    "width": target.width,
                    "height": target.height,
                },
            }),
            ThreadsafeFunctionCallMode::NonBlocking,
        ) == Status::Ok
    }

    fn notify_presentation_invalidated(&self, token: &str, pair_id: &str, sequence: &str) -> bool {
        if token != self.token || parse_pair_generation(&self.token, pair_id).is_none() {
            return false;
        }
        let Some(sequence) = parse_presentation_counter(sequence) else {
            return false;
        };
        self.handler.call(
            json!({
                "kind": "presentationStateInvalidated",
                "pairId": pair_id,
                "sequence": sequence,
            }),
            ThreadsafeFunctionCallMode::NonBlocking,
        ) == Status::Ok
    }
}

pub fn start(token: String, handler: JsCallback<'_, serde_json::Value>) -> Result<String, Error> {
    if token.is_empty() || token.len() > MAX_TOKEN_LENGTH {
        return Err(Error::from_reason(
            "Invalid KWin overlay-host synchronization event receiver configuration",
        ));
    }

    let threadsafe_handler = Arc::new(
        handler
            .build_threadsafe_function::<serde_json::Value>()
            .weak::<true>()
            .build_callback(|ctx| Ok(FnArgs::from((ctx.value,))))?,
    );
    let mut active_runtime = receiver_runtime()
        .lock()
        .unwrap_or_else(|poisoned| poisoned.into_inner());
    if let Some(active) = active_runtime.take() {
        stop_runtime(active);
    }
    let (ready_tx, ready_rx) = mpsc::sync_channel::<Result<String, String>>(1);
    let (stop_tx, stop_rx) = oneshot::channel::<()>();
    let running = Arc::new(AtomicBool::new(false));
    let thread_running = running.clone();
    let thread = std::thread::Builder::new()
        .name("steam-bridge-kwin-dbus".to_owned())
        .spawn(move || {
            let _running_guard = ReceiverRunningGuard(thread_running.clone());
            let runtime = match tokio::runtime::Builder::new_current_thread()
                .enable_all()
                .build()
            {
                Ok(runtime) => runtime,
                Err(error) => {
                    let _ = ready_tx.send(Err(error.to_string()));
                    return;
                }
            };
            runtime.block_on(async move {
                let mut stop_rx = stop_rx;
                let transport_handler = Arc::clone(&threadsafe_handler);
                let interface = OverlayHostSyncEvents {
                    token,
                    handler: threadsafe_handler,
                };
                let builder = match zbus::connection::Builder::session()
                    .and_then(|builder| builder.serve_at(OBJECT_PATH, interface))
                {
                    Ok(builder) => builder,
                    Err(error) => {
                        let _ = ready_tx.send(Err(error.to_string()));
                        return;
                    }
                };
                let connection = match await_startup_or_stop(&mut stop_rx, builder.build()).await {
                    Some(Ok(connection)) => connection,
                    Some(Err(error)) => {
                        let _ = ready_tx.send(Err(error.to_string()));
                        return;
                    }
                    None => return,
                };
                let Some(unique_name) = connection.unique_name() else {
                    let _ =
                        ready_tx.send(Err("session bus did not assign a unique name".to_owned()));
                    return;
                };
                thread_running.store(true, Ordering::Release);
                if ready_tx.send(Ok(unique_name.to_string())).is_err() {
                    return;
                }
                tokio::select! {
                    // An explicit JS/process teardown is not a transport loss
                    // and must never schedule a live geometry-owner handoff.
                    biased;
                    _ = &mut stop_rx => {}
                    _ = connection.closed() => {
                        // Publish the health transition before enqueueing the
                        // JS event. If the TSFN queue is unavailable, the
                        // synchronous health query still observes the loss;
                        // if it is delivered, a reentrant query cannot see a
                        // stale running=true value.
                        thread_running.store(false, Ordering::Release);
                        let _ = transport_handler.call(
                            json!({ "kind": "transportClosed" }),
                            ThreadsafeFunctionCallMode::NonBlocking,
                        );
                    }
                }
                drop(connection);
            });
        })
        .map_err(|error| {
            Error::new(
                Status::GenericFailure,
                format!("KWin overlay-host synchronization D-Bus receiver unavailable: {error}"),
            )
        })?;

    let result = match ready_rx.recv_timeout(Duration::from_millis(1500)) {
        Ok(Ok(unique_name)) => Ok(unique_name),
        Ok(Err(error)) => Err(Error::new(
            Status::GenericFailure,
            format!("KWin overlay-host synchronization D-Bus receiver unavailable: {error}"),
        )),
        Err(error) => Err(Error::new(
            Status::GenericFailure,
            format!("KWin overlay-host synchronization D-Bus receiver unavailable: {error}"),
        )),
    };
    match result {
        Ok(unique_name) => {
            *active_runtime = Some(ReceiverRuntime {
                stop: Some(stop_tx),
                thread: Some(thread),
                running,
            });
            Ok(unique_name)
        }
        Err(error) => {
            stop_runtime(ReceiverRuntime {
                stop: Some(stop_tx),
                thread: Some(thread),
                running,
            });
            Err(error)
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn receiver_startup_can_be_cancelled_before_the_bus_connects() {
        let runtime = tokio::runtime::Builder::new_current_thread()
            .enable_all()
            .build()
            .expect("test runtime");
        runtime.block_on(async {
            let (stop_tx, mut stop_rx) = oneshot::channel::<()>();
            stop_tx.send(()).expect("deliver stop");
            let result: Option<()> =
                await_startup_or_stop(&mut stop_rx, std::future::pending()).await;
            assert!(result.is_none());
        });
    }

    #[test]
    fn validates_presentation_sequences_and_geometry_ranges() {
        assert_eq!(parse_sequence("1"), Some(1));
        assert_eq!(
            parse_sequence("9007199254740991"),
            Some(MAX_JAVASCRIPT_SAFE_SEQUENCE)
        );
        assert_eq!(parse_sequence("0"), None);
        assert_eq!(parse_sequence("9007199254740992"), None);
        assert_eq!(parse_sequence("1.5"), None);
        assert_eq!(parse_presentation_epoch("0"), Some(0));
        assert_eq!(parse_presentation_epoch("4294967295"), Some(u32::MAX));
        assert_eq!(parse_presentation_epoch("4294967296"), None);
        assert_eq!(parse_presentation_epoch("-1"), None);
        assert_eq!(parse_pair_generation("token", "token:1"), Some(1));
        assert_eq!(parse_pair_generation("token", "other:1"), None);
        assert_eq!(parse_pair_generation("token", "token:0"), None);
        assert_eq!(parse_pair_generation("token", "token:1.5"), None);

        let geometry = parse_geometry("-10.5", "20.25", "1280", "720").unwrap();
        assert_eq!(geometry.x, -10.5);
        assert_eq!(geometry.y, 20.25);
        assert_eq!(geometry.width, 1280.0);
        assert_eq!(geometry.height, 720.0);
        assert!(parse_geometry("NaN", "0", "1", "1").is_none());
        assert!(parse_geometry("0", "inf", "1", "1").is_none());
        assert!(parse_geometry("0", "0", "0", "1").is_none());
        assert!(parse_geometry("0", "0", "1", "-1").is_none());
        assert!(parse_geometry("2147483648", "0", "1", "1").is_none());
        assert!(parse_geometry("0", "0", "2147483648", "1").is_none());
        let tuple = parse_geometry_tuple("-10.5,20.25,1280,720").unwrap();
        assert_eq!(tuple.x, -10.5);
        assert_eq!(tuple.y, 20.25);
        assert_eq!(tuple.width, 1280.0);
        assert_eq!(tuple.height, 720.0);
        assert!(parse_geometry_tuple("0,0,1").is_none());
        assert!(parse_geometry_tuple("0,0,1,1,extra").is_none());
        assert!(parse_geometry_tuple("0,0,0,1").is_none());
    }
}
