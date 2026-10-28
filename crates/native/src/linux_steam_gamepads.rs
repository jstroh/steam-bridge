#![cfg_attr(not(any(target_os = "linux", test)), allow(dead_code))]

use serde::Serialize;

const AXIS_CAPACITY: usize = 64;
const BUTTON_CAPACITY: usize = 32;
const JS_BUTTON: u8 = 1;
const JS_AXIS: u8 = 2;
const JS_INIT: u8 = 0x80;
const STANDARD_AXIS_CODES: [u8; 8] = [0, 1, 3, 4, 2, 5, 16, 17];
const STANDARD_BUTTON_CODES: [u16; 11] = [
    0x130, 0x131, 0x133, 0x134, 0x136, 0x137, 0x13a, 0x13b, 0x13d, 0x13e, 0x13c,
];

#[derive(Clone, Copy, Default, Serialize)]
struct Button {
    pressed: bool,
    touched: bool,
    value: f64,
}

impl Button {
    fn from_value(value: f64) -> Self {
        Self {
            pressed: value > 30.0 / 255.0,
            touched: value > 0.0,
            value,
        }
    }
}

#[derive(Clone, Serialize)]
struct Pad {
    instance: String,
    id: String,
    mapping: &'static str,
    axes: [f64; 4],
    buttons: [Button; 18],
}

impl Pad {
    fn new(instance: u64) -> Self {
        Self {
            instance: instance.to_string(),
            id: format!(
                "Steam Input Virtual Gamepad #{instance} (STANDARD GAMEPAD Vendor: 28de Product: 11ff)"
            ),
            mapping: "standard",
            axes: [0.0; 4],
            buttons: [Button::default(); 18],
        }
    }

    fn neutral(&self) -> bool {
        self.axes.iter().all(|value| value.abs() <= 0.2)
            && self.buttons.iter().all(|button| !button.pressed)
    }

    fn activity(&self) -> bool {
        self.axes.iter().any(|value| value.abs() >= 0.2)
            || self.buttons.iter().any(|button| button.pressed)
    }
}

#[derive(Clone)]
struct Profile {
    axes: [usize; 8],
    buttons: [Option<usize>; 11],
    axis_count: usize,
    button_count: usize,
}

impl Profile {
    fn new(axis_map: &[u8], button_map: &[u16]) -> Option<Self> {
        if axis_map.is_empty()
            || axis_map.len() > AXIS_CAPACITY
            || button_map.is_empty()
            || button_map.len() > BUTTON_CAPACITY
        {
            return None;
        }
        let mut axes = [0; 8];
        for (target, code) in STANDARD_AXIS_CODES.iter().enumerate() {
            let mut indexes = axis_map
                .iter()
                .enumerate()
                .filter_map(|(index, value)| (value == code).then_some(index));
            axes[target] = indexes.next()?;
            if indexes.next().is_some() {
                return None;
            }
        }
        let mut buttons = [None; 11];
        for (target, code) in STANDARD_BUTTON_CODES.iter().enumerate() {
            let mut indexes = button_map
                .iter()
                .enumerate()
                .filter_map(|(index, value)| (value == code).then_some(index));
            buttons[target] = indexes.next();
            if indexes.next().is_some() || (target < 10 && buttons[target].is_none()) {
                return None;
            }
        }
        Some(Self {
            axes,
            buttons,
            axis_count: axis_map.len(),
            button_count: button_map.len(),
        })
    }
}

struct State {
    profile: Profile,
    axes: [i16; AXIS_CAPACITY],
    buttons: [bool; BUTTON_CAPACITY],
    axes_initialized: u64,
    buttons_initialized: u32,
    initializing: bool,
    cycle: u64,
    armed: bool,
    admitted: bool,
    pad: Pad,
}

impl State {
    fn new(profile: Profile, instance: u64) -> Self {
        Self {
            profile,
            axes: [0; AXIS_CAPACITY],
            buttons: [false; BUTTON_CAPACITY],
            axes_initialized: 0,
            buttons_initialized: 0,
            initializing: true,
            cycle: 0,
            armed: false,
            admitted: false,
            pad: Pad::new(instance),
        }
    }

    fn ready(&self) -> bool {
        self.axes_initialized.count_ones() as usize == self.profile.axis_count
            && self.buttons_initialized.count_ones() as usize == self.profile.button_count
    }

    fn apply(&mut self, event: &[u8]) -> bool {
        if event.len() != 8 {
            return false;
        }
        let value = i16::from_ne_bytes([event[4], event[5]]);
        let kind = event[6] & !JS_INIT;
        let index = usize::from(event[7]);
        let initial = event[6] & JS_INIT != 0;
        if (kind != JS_BUTTON && kind != JS_AXIS)
            || (kind == JS_BUTTON
                && (index >= self.profile.button_count || !matches!(value, 0 | 1)))
            || (kind == JS_AXIS && index >= self.profile.axis_count)
        {
            return false;
        }
        if initial && !self.initializing {
            self.axes_initialized = 0;
            self.buttons_initialized = 0;
            self.initializing = true;
            self.cycle = self.cycle.saturating_add(1);
            self.armed = false;
            self.admitted = false;
        }
        if kind == JS_BUTTON {
            self.buttons[index] = value != 0;
            if initial {
                self.buttons_initialized |= 1_u32 << index;
            }
        } else {
            self.axes[index] = value;
            if initial {
                self.axes_initialized |= 1_u64 << index;
            }
        }
        self.normalize();
        if self.ready() {
            self.initializing = false;
            if self.pad.neutral() {
                self.armed = true;
            } else if !initial && self.armed && self.pad.activity() {
                self.admitted = true;
            }
        }
        true
    }

    fn normalize(&mut self) {
        let axis = |index: usize| {
            (f64::from(self.axes[self.profile.axes[index]]) / 32767.0).clamp(-1.0, 1.0)
        };
        for index in 0..4 {
            self.pad.axes[index] = axis(index);
        }
        self.pad.buttons.fill(Button::default());
        for (source, target) in [0, 1, 2, 3, 4, 5, 8, 9, 10, 11, 16].into_iter().enumerate() {
            let down = self.profile.buttons[source].is_some_and(|index| self.buttons[index]);
            self.pad.buttons[target] = Button::from_value(if down { 1.0 } else { 0.0 });
        }
        self.pad.buttons[6] = Button::from_value((axis(4) + 1.0) / 2.0);
        self.pad.buttons[7] = Button::from_value((axis(5) + 1.0) / 2.0);
        for (target, down) in [
            (12, axis(7) < -0.5),
            (13, axis(7) > 0.5),
            (14, axis(6) < -0.5),
            (15, axis(6) > 0.5),
        ] {
            self.pad.buttons[target] = Button::from_value(if down { 1.0 } else { 0.0 });
        }
    }
}

fn valid_epoch(epoch: &str) -> bool {
    !epoch.is_empty()
        && epoch.len() <= 20
        && epoch.bytes().all(|value| value.is_ascii_digit())
        && (epoch == "0" || !epoch.starts_with('0'))
        && epoch.parse::<u64>().is_ok()
}

#[cfg(target_os = "linux")]
mod linux {
    use super::*;
    use once_cell::sync::Lazy;
    use serde::ser::{SerializeSeq, Serializer};
    use std::collections::BTreeMap;
    use std::fs::{self, File, OpenOptions};
    use std::io::{self, Read};
    use std::os::fd::{AsRawFd, FromRawFd};
    use std::os::unix::fs::{FileTypeExt, MetadataExt, OpenOptionsExt};
    use std::path::{Path, PathBuf};
    use std::sync::{Mutex, PoisonError};

    const SYSFS: &str = "/sys/class/input";
    const INPUT: &str = "/dev/input";
    const MAX_DEVICES: usize = 16;
    const MAX_READS: usize = 32;

    #[derive(Clone, PartialEq, Eq)]
    struct DeviceKey {
        parent: PathBuf,
        rdev: u64,
    }

    struct Device {
        key: DeviceKey,
        file: File,
        state: State,
        buffer: [u8; 512],
    }

    fn ioctl_request<T>(number: u8) -> u64 {
        (2_u64 << 30)
            | ((std::mem::size_of::<T>() as u64) << 16)
            | (u64::from(b'j') << 8)
            | u64::from(number)
    }

    fn ioctl_read<T>(file: &File, number: u8, value: &mut T) -> io::Result<()> {
        let request = ioctl_request::<T>(number);
        let status = unsafe { libc::ioctl(file.as_raw_fd(), request as libc::c_ulong, value) };
        if status < 0 {
            return Err(io::Error::last_os_error());
        }
        Ok(())
    }

    fn bounded_text(path: &Path) -> io::Result<String> {
        let mut text = String::new();
        File::open(path)?.take(4097).read_to_string(&mut text)?;
        if text.len() > 4096 {
            return Err(io::ErrorKind::InvalidData.into());
        }
        Ok(text)
    }

    fn descriptor(name: &str) -> io::Result<Option<DeviceKey>> {
        if !name.starts_with("js")
            || name.len() <= 2
            || name.len() > 8
            || !name[2..].bytes().all(|value| value.is_ascii_digit())
        {
            return Ok(None);
        }
        let source = Path::new(SYSFS).join(name);
        let parent = fs::canonicalize(source.join("device"))?;
        if !parent.starts_with("/sys/devices/virtual/input") {
            return Ok(None);
        }
        let vendor = bounded_text(&parent.join("id/vendor"))?;
        let product = bounded_text(&parent.join("id/product"))?;
        if vendor.trim() != "28de" || product.trim() != "11ff" {
            return Ok(None);
        }
        let path = Path::new(INPUT).join(name);
        let metadata = fs::symlink_metadata(path)?;
        if !metadata.file_type().is_char_device() {
            return Err(io::ErrorKind::InvalidData.into());
        }
        let dev = bounded_text(&source.join("dev"))?;
        let expected = format!(
            "{}:{}",
            libc::major(metadata.rdev()),
            libc::minor(metadata.rdev())
        );
        if dev.trim() != expected {
            return Err(io::ErrorKind::InvalidData.into());
        }
        Ok(Some(DeviceKey {
            parent,
            rdev: metadata.rdev(),
        }))
    }

    impl Device {
        fn open(name: &str, key: DeviceKey, instance: u64) -> io::Result<Self> {
            let file = OpenOptions::new()
                .read(true)
                .custom_flags(libc::O_NONBLOCK | libc::O_CLOEXEC | libc::O_NOFOLLOW)
                .open(Path::new(INPUT).join(name))?;
            if file.metadata()?.rdev() != key.rdev || descriptor(name)?.as_ref() != Some(&key) {
                return Err(io::ErrorKind::InvalidData.into());
            }
            let mut axes = 0_u8;
            let mut buttons = 0_u8;
            let mut axis_map = [0_u8; AXIS_CAPACITY];
            let mut button_map = [0_u16; 512];
            ioctl_read(&file, 0x11, &mut axes)?;
            ioctl_read(&file, 0x12, &mut buttons)?;
            ioctl_read(&file, 0x32, &mut axis_map)?;
            ioctl_read(&file, 0x34, &mut button_map)?;
            if usize::from(axes) > AXIS_CAPACITY || usize::from(buttons) > BUTTON_CAPACITY {
                return Err(io::ErrorKind::InvalidData.into());
            }
            let profile = Profile::new(
                &axis_map[..usize::from(axes)],
                &button_map[..usize::from(buttons)],
            )
            .ok_or(io::ErrorKind::InvalidData)?;
            Ok(Self {
                key,
                file,
                state: State::new(profile, instance),
                buffer: [0; 512],
            })
        }

        fn drain(&mut self) -> io::Result<bool> {
            for _ in 0..MAX_READS {
                match self.file.read(&mut self.buffer) {
                    Ok(0) => return Err(io::ErrorKind::UnexpectedEof.into()),
                    Ok(count) => {
                        if count % 8 != 0 {
                            return Err(io::ErrorKind::InvalidData.into());
                        }
                        for event in self.buffer[..count].chunks_exact(8) {
                            if !self.state.apply(event) {
                                return Err(io::ErrorKind::InvalidData.into());
                            }
                        }
                    }
                    Err(error) if error.kind() == io::ErrorKind::WouldBlock => {
                        return Ok(self.state.ready());
                    }
                    Err(error) if error.kind() == io::ErrorKind::Interrupted => continue,
                    Err(error) => return Err(error),
                }
            }
            Ok(false)
        }
    }

    struct Watch {
        file: File,
        buffer: [u8; 4096],
    }

    impl Watch {
        fn new() -> io::Result<Self> {
            let fd = unsafe { libc::inotify_init1(libc::IN_NONBLOCK | libc::IN_CLOEXEC) };
            if fd < 0 {
                return Err(io::Error::last_os_error());
            }
            let file = unsafe { File::from_raw_fd(fd) };
            let mask = libc::IN_CREATE
                | libc::IN_DELETE
                | libc::IN_MOVED_FROM
                | libc::IN_MOVED_TO
                | libc::IN_ATTRIB
                | libc::IN_DELETE_SELF
                | libc::IN_MOVE_SELF;
            if unsafe { libc::inotify_add_watch(fd, c"/dev/input".as_ptr(), mask) } < 0 {
                return Err(io::Error::last_os_error());
            }
            Ok(Self {
                file,
                buffer: [0; 4096],
            })
        }

        fn changed(&mut self) -> io::Result<bool> {
            let mut changed = false;
            for _ in 0..MAX_READS {
                match self.file.read(&mut self.buffer) {
                    Ok(0) => return Err(io::ErrorKind::UnexpectedEof.into()),
                    Ok(_) => changed = true,
                    Err(error) if error.kind() == io::ErrorKind::WouldBlock => return Ok(changed),
                    Err(error) if error.kind() == io::ErrorKind::Interrupted => continue,
                    Err(error) => return Err(error),
                }
            }
            Ok(true)
        }
    }

    #[derive(Default)]
    struct Reader {
        epoch: Option<String>,
        watch: Option<Watch>,
        devices: BTreeMap<String, Device>,
        next_instance: u64,
        sequence: u64,
        dirty: bool,
        complete: bool,
    }

    struct Pads<'a>(&'a BTreeMap<String, Device>);

    impl Serialize for Pads<'_> {
        fn serialize<S: Serializer>(&self, serializer: S) -> Result<S::Ok, S::Error> {
            let mut sequence = serializer.serialize_seq(None)?;
            for device in self.0.values() {
                if device.state.ready() && device.state.admitted {
                    sequence.serialize_element(&device.state.pad)?;
                }
            }
            sequence.end()
        }
    }

    fn sequence_string<S: Serializer>(value: &u64, serializer: S) -> Result<S::Ok, S::Error> {
        serializer.collect_str(value)
    }

    #[derive(Serialize)]
    #[serde(rename_all = "camelCase")]
    struct Frame<'a> {
        version: u8,
        provider: &'static str,
        supported: bool,
        #[serde(serialize_with = "sequence_string")]
        sequence: u64,
        input_epoch: &'a str,
        active: bool,
        complete: bool,
        controllers: Pads<'a>,
    }

    impl Reader {
        fn discover(&mut self) -> io::Result<bool> {
            let mut complete = true;
            let mut candidates = BTreeMap::new();
            let mut unresolved = Vec::new();
            for entry in fs::read_dir(SYSFS)? {
                let name = entry?.file_name();
                let Some(name) = name.to_str() else { continue };
                match descriptor(name) {
                    Ok(Some(key)) => {
                        if candidates.len() >= MAX_DEVICES {
                            return Err(io::ErrorKind::InvalidData.into());
                        }
                        if candidates.values().any(|previous| previous == &key) {
                            return Err(io::ErrorKind::InvalidData.into());
                        }
                        candidates.insert(name.to_owned(), key);
                    }
                    Ok(None) => {}
                    Err(_) => {
                        complete = false;
                        unresolved.push(name.to_owned());
                    }
                }
            }
            self.devices.retain(|name, device| {
                candidates.get(name) == Some(&device.key) || unresolved.contains(name)
            });
            for (name, key) in candidates {
                if !self.devices.contains_key(&name) {
                    self.next_instance = self
                        .next_instance
                        .checked_add(1)
                        .ok_or(io::ErrorKind::InvalidData)?;
                    match Device::open(&name, key, self.next_instance) {
                        Ok(device) => {
                            self.devices.insert(name, device);
                        }
                        Err(_) => complete = false,
                    }
                }
            }
            Ok(complete)
        }

        fn drain_devices(&mut self) {
            self.devices.retain(|_, device| {
                let old_cycle = device.state.cycle;
                match device.drain() {
                    Ok(ready) => self.complete &= ready,
                    Err(_) => {
                        self.complete = false;
                        self.dirty = true;
                        return false;
                    }
                }
                if device.state.cycle != old_cycle {
                    self.next_instance = self.next_instance.saturating_add(1);
                    let axes = device.state.pad.axes;
                    let buttons = device.state.pad.buttons;
                    device.state.pad = Pad::new(self.next_instance);
                    device.state.pad.axes = axes;
                    device.state.pad.buttons = buttons;
                }
                true
            });
        }

        fn capture(&mut self, active: bool, epoch: &str) -> Result<String, serde_json::Error> {
            self.sequence = self.sequence.saturating_add(1);
            if !active || self.epoch.as_deref() != Some(epoch) {
                self.devices.clear();
                self.watch = None;
                self.epoch = active.then(|| epoch.to_owned());
                self.dirty = true;
            }
            self.complete = !active;
            if active {
                if self.watch.is_none() {
                    self.watch = Watch::new().ok();
                    self.dirty = true;
                }
                if let Some(watch) = &mut self.watch {
                    match watch.changed() {
                        Ok(changed) => self.dirty |= changed,
                        Err(_) => {
                            self.watch = None;
                            self.dirty = true;
                        }
                    }
                }
                self.complete = self.watch.is_some();
                if self.dirty {
                    self.complete &= matches!(self.discover(), Ok(true));
                    self.dirty = !self.complete;
                }
                self.drain_devices();
            }
            serde_json::to_string(&Frame {
                version: 1,
                provider: "linux-steam-emulation-v1",
                supported: true,
                sequence: self.sequence,
                input_epoch: epoch,
                active,
                complete: self.complete,
                controllers: Pads(&self.devices),
            })
        }
    }

    static READER: Lazy<Mutex<Reader>> = Lazy::new(|| Mutex::new(Reader::default()));

    pub(super) fn capture(active: bool, epoch: &str) -> Result<String, &'static str> {
        let mut reader = READER
            .lock()
            .map_err(|_| "Linux gamepad reader unavailable")?;
        reader
            .capture(active, epoch)
            .map_err(|_| "Linux gamepad snapshot unavailable")
    }

    pub(super) fn reset() {
        let mut reader = READER.lock().unwrap_or_else(PoisonError::into_inner);
        reader.devices.clear();
        reader.watch = None;
        reader.epoch = None;
        reader.dirty = true;
        reader.complete = false;
    }

    #[cfg(test)]
    mod tests {
        use super::*;
        use std::io::Write;

        fn event(kind: u8, index: u8, value: i16) -> [u8; 8] {
            let mut event = [0; 8];
            event[4..6].copy_from_slice(&value.to_ne_bytes());
            event[6] = kind;
            event[7] = index;
            event
        }

        fn initialization() -> Vec<u8> {
            let mut events = Vec::new();
            for index in 0..11 {
                events.extend(event(JS_INIT | JS_BUTTON, index, 0));
            }
            for index in 0..8 {
                events.extend(event(
                    JS_INIT | JS_AXIS,
                    index,
                    if index == 4 || index == 5 { -32767 } else { 0 },
                ));
            }
            events
        }

        fn pipe_device(instance: u64) -> (Device, File) {
            let mut fds = [0; 2];
            assert_eq!(
                unsafe { libc::pipe2(fds.as_mut_ptr(), libc::O_NONBLOCK | libc::O_CLOEXEC) },
                0
            );
            let device = Device {
                key: DeviceKey {
                    parent: format!("/sys/devices/virtual/input/input{instance}").into(),
                    rdev: instance,
                },
                file: unsafe { File::from_raw_fd(fds[0]) },
                state: State::new(
                    Profile::new(&STANDARD_AXIS_CODES, &STANDARD_BUTTON_CODES).unwrap(),
                    instance,
                ),
                buffer: [0; 512],
            };
            (device, unsafe { File::from_raw_fd(fds[1]) })
        }

        #[test]
        fn joystick_ioctl_requests_match_linux_joydev_encoding() {
            assert_eq!(ioctl_request::<u8>(0x11), 0x80016a11);
            assert_eq!(ioctl_request::<u8>(0x12), 0x80016a12);
            assert_eq!(ioctl_request::<[u8; AXIS_CAPACITY]>(0x32), 0x80406a32);
            assert_eq!(ioctl_request::<[u16; 512]>(0x34), 0x84006a34);
        }

        #[test]
        fn inactive_frames_have_exact_schema_and_release_devices() {
            let (device, _events) = pipe_device(1);
            let mut reader = Reader {
                epoch: Some("7".to_owned()),
                next_instance: 1,
                ..Reader::default()
            };
            reader.devices.insert("js0".to_owned(), device);
            let frame: serde_json::Value =
                serde_json::from_str(&reader.capture(false, "7").unwrap()).unwrap();
            assert_eq!(
                frame,
                serde_json::json!({
                    "version": 1,
                    "provider": "linux-steam-emulation-v1",
                    "supported": true,
                    "sequence": "1",
                    "inputEpoch": "7",
                    "active": false,
                    "complete": true,
                    "controllers": []
                })
            );
            assert!(reader.devices.is_empty() && reader.epoch.is_none() && reader.dirty);
            let frame: serde_json::Value =
                serde_json::from_str(&reader.capture(false, "8").unwrap()).unwrap();
            assert_eq!(frame["sequence"], "2");
            assert_eq!(frame["inputEpoch"], "8");
        }

        #[test]
        fn failed_devices_are_dropped_and_resynchronized_pads_are_renumbered() {
            let (first, mut first_events) = pipe_device(1);
            let (second, second_events) = pipe_device(2);
            let mut reader = Reader {
                next_instance: 2,
                complete: true,
                ..Reader::default()
            };
            reader.devices.insert("js0".to_owned(), first);
            reader.devices.insert("js1".to_owned(), second);
            first_events.write_all(&initialization()).unwrap();
            first_events.write_all(&event(JS_BUTTON, 0, 1)).unwrap();
            drop(second_events);
            reader.drain_devices();
            assert!(!reader.complete && reader.dirty);
            assert!(reader.devices.contains_key("js0") && !reader.devices.contains_key("js1"));
            let pads = serde_json::to_value(Pads(&reader.devices)).unwrap();
            assert_eq!(pads.as_array().unwrap().len(), 1);
            assert_eq!(pads[0]["instance"], "1");
            assert_eq!(
                pads[0]["id"],
                "Steam Input Virtual Gamepad #1 (STANDARD GAMEPAD Vendor: 28de Product: 11ff)"
            );
            assert_eq!(pads[0]["mapping"], "standard");
            assert_eq!(pads[0]["axes"].as_array().unwrap().len(), 4);
            assert_eq!(pads[0]["buttons"].as_array().unwrap().len(), 18);
            assert_eq!(
                pads[0]["buttons"][0],
                serde_json::json!({ "pressed": true, "touched": true, "value": 1.0 })
            );

            reader.complete = true;
            first_events.write_all(&initialization()).unwrap();
            reader.drain_devices();
            assert!(reader.complete);
            assert_eq!(reader.next_instance, 3);
            assert_eq!(reader.devices["js0"].state.pad.instance, "3");
            assert!(serde_json::to_value(Pads(&reader.devices))
                .unwrap()
                .as_array()
                .unwrap()
                .is_empty());
            first_events.write_all(&event(JS_AXIS, 0, 24575)).unwrap();
            reader.drain_devices();
            assert_eq!(
                serde_json::to_value(Pads(&reader.devices)).unwrap()[0]["instance"],
                "3"
            );
        }

        #[test]
        fn virtual_input_parents_are_independent_device_identities() {
            let first = DeviceKey {
                parent: "/sys/devices/virtual/input/input100".into(),
                rdev: 1,
            };
            let second = DeviceKey {
                parent: "/sys/devices/virtual/input/input101".into(),
                rdev: 2,
            };
            assert!(first != second);
            assert!(
                first
                    != DeviceKey {
                        parent: first.parent.clone(),
                        rdev: 2
                    }
            );
        }
    }
}

pub(crate) fn capture(active: bool, epoch: &str) -> Result<String, &'static str> {
    if !valid_epoch(epoch) {
        return Err("Invalid Linux gamepad context epoch");
    }
    #[cfg(target_os = "linux")]
    {
        linux::capture(active, epoch)
    }
    #[cfg(not(target_os = "linux"))]
    {
        let _ = active;
        Ok("{\"version\":1,\"supported\":false}".to_owned())
    }
}

#[cfg(target_os = "linux")]
pub(crate) fn reset() {
    linux::reset();
}

#[cfg(test)]
mod tests {
    use super::*;

    fn profile() -> Profile {
        Profile::new(
            &[0, 1, 2, 3, 4, 5, 16, 17],
            &[
                0x130, 0x131, 0x133, 0x134, 0x136, 0x137, 0x13a, 0x13b, 0x13c, 0x13d, 0x13e,
            ],
        )
        .unwrap()
    }

    fn event(kind: u8, index: u8, value: i16) -> [u8; 8] {
        let mut event = [0; 8];
        event[4..6].copy_from_slice(&value.to_ne_bytes());
        event[6] = kind;
        event[7] = index;
        event
    }

    fn initialize(state: &mut State, held: bool) {
        for index in 0..11 {
            assert!(state.apply(&event(
                JS_INIT | JS_BUTTON,
                index,
                i16::from(held && index == 0)
            )));
        }
        for index in 0..8 {
            assert!(state.apply(&event(
                JS_INIT | JS_AXIS,
                index,
                if index == 2 || index == 5 { -32767 } else { 0 }
            )));
        }
    }

    #[test]
    fn initial_held_button_needs_physical_neutral_then_fresh_press() {
        let mut state = State::new(profile(), 1);
        initialize(&mut state, true);
        assert!(state.ready());
        assert!(!state.armed && !state.admitted);
        assert!(state.apply(&event(JS_BUTTON, 0, 1)));
        assert!(!state.admitted);
        assert!(state.apply(&event(JS_BUTTON, 0, 0)));
        assert!(state.armed && !state.admitted);
        assert!(state.apply(&event(JS_BUTTON, 0, 1)));
        assert!(state.admitted && state.pad.buttons[0].pressed);
    }

    #[test]
    fn analog_triggers_use_standard_gamepad_pressed_threshold() {
        let mut state = State::new(profile(), 1);
        initialize(&mut state, false);
        assert!(state.apply(&event(JS_AXIS, 5, -26214)));
        assert!(state.pad.buttons[7].touched && !state.pad.buttons[7].pressed);
        assert!(state.armed && !state.admitted);
        assert!(state.apply(&event(JS_AXIS, 5, -19660)));
        assert!(state.pad.buttons[7].pressed && state.admitted);
    }

    #[test]
    fn partially_held_trigger_is_not_neutral() {
        let mut state = State::new(profile(), 1);
        for index in 0..11 {
            assert!(state.apply(&event(JS_INIT | JS_BUTTON, index, 0)));
        }
        for index in 0..8 {
            assert!(state.apply(&event(
                JS_INIT | JS_AXIS,
                index,
                match index {
                    2 => -32767,
                    5 => -22936,
                    _ => 0,
                }
            )));
        }
        assert!(state.ready() && state.pad.buttons[7].pressed);
        assert!(!state.armed && !state.admitted);
    }

    #[test]
    fn invalid_epoch_is_rejected_on_every_platform() {
        for invalid in ["", "01", "1.5"] {
            assert_eq!(
                capture(false, invalid),
                Err("Invalid Linux gamepad context epoch")
            );
        }
        #[cfg(not(target_os = "linux"))]
        assert_eq!(
            capture(true, "1").as_deref(),
            Ok("{\"version\":1,\"supported\":false}")
        );
    }

    #[test]
    fn first_fresh_stick_move_admits_after_complete_neutral_initialization() {
        let mut state = State::new(profile(), 1);
        initialize(&mut state, false);
        assert!(state.armed && !state.admitted);
        assert!(state.apply(&event(JS_AXIS, 0, 24575)));
        assert!(state.admitted);
        assert!((state.pad.axes[0] - 0.75).abs() < 0.001);
    }

    #[test]
    fn partial_initial_state_cannot_admit_or_manufacture_neutral() {
        let mut state = State::new(profile(), 1);
        assert!(state.apply(&event(JS_INIT | JS_BUTTON, 0, 0)));
        assert!(state.apply(&event(JS_BUTTON, 0, 1)));
        assert!(!state.ready() && !state.armed && !state.admitted);
    }

    #[test]
    fn startup_resynchronization_requarantines_held_input() {
        let mut state = State::new(profile(), 1);
        initialize(&mut state, false);
        state.apply(&event(JS_BUTTON, 0, 1));
        assert!(state.admitted);
        initialize(&mut state, true);
        assert_eq!(state.cycle, 1);
        assert!(!state.armed && !state.admitted);
        state.apply(&event(JS_BUTTON, 0, 0));
        state.apply(&event(JS_BUTTON, 0, 1));
        assert!(state.admitted);
    }

    #[test]
    fn steam_xinput_letters_triggers_hats_and_menu_positions_are_preserved() {
        let mut state = State::new(profile(), 1);
        initialize(&mut state, false);
        state.apply(&event(JS_BUTTON, 2, 1));
        assert!(state.pad.buttons[2].pressed && !state.pad.buttons[3].pressed);
        state.apply(&event(JS_BUTTON, 2, 0));
        state.apply(&event(JS_BUTTON, 3, 1));
        assert!(state.pad.buttons[3].pressed && !state.pad.buttons[2].pressed);
        state.apply(&event(JS_AXIS, 2, 32767));
        state.apply(&event(JS_AXIS, 5, 0));
        assert_eq!(state.pad.buttons[6].value, 1.0);
        assert_eq!(state.pad.buttons[7].value, 0.5);
        state.apply(&event(JS_AXIS, 6, -32767));
        state.apply(&event(JS_AXIS, 7, 32767));
        assert!(state.pad.buttons[14].pressed && state.pad.buttons[13].pressed);
        state.apply(&event(JS_BUTTON, 6, 1));
        state.apply(&event(JS_BUTTON, 7, 1));
        assert!(state.pad.buttons[8].pressed && state.pad.buttons[9].pressed);
    }

    #[test]
    fn mapping_uses_ioctl_codes_not_axis_or_button_enumeration_positions() {
        let axes = [17, 16, 5, 4, 3, 2, 1, 0];
        let buttons = [
            0x13e, 0x13d, 0x13c, 0x13b, 0x13a, 0x137, 0x136, 0x134, 0x133, 0x131, 0x130,
        ];
        let mut state = State::new(Profile::new(&axes, &buttons).unwrap(), 2);
        for index in 0..11 {
            state.apply(&event(JS_INIT | JS_BUTTON, index, 0));
        }
        for index in 0..8 {
            state.apply(&event(
                JS_INIT | JS_AXIS,
                index,
                if index == 2 || index == 5 { -32767 } else { 0 },
            ));
        }
        state.apply(&event(JS_BUTTON, 10, 1));
        state.apply(&event(JS_AXIS, 7, 16384));
        assert!(state.pad.buttons[0].pressed);
        assert!((state.pad.axes[0] - 0.5).abs() < 0.001);
    }

    #[test]
    fn malformed_event_and_ambiguous_mapping_are_rejected() {
        let mut state = State::new(profile(), 1);
        assert!(!state.apply(&[0; 7]));
        assert!(!state.apply(&event(JS_BUTTON, 32, 1)));
        assert!(!state.apply(&event(JS_AXIS, 64, 0)));
        assert!(!state.apply(&event(4, 0, 0)));
        assert!(!state.apply(&event(JS_BUTTON, 0, 2)));
        assert!(Profile::new(&[0, 1, 2, 3, 4, 5, 16, 16], &STANDARD_BUTTON_CODES).is_none());
        assert!(Profile::new(&STANDARD_AXIS_CODES, &[0x130, 0x130]).is_none());
    }

    #[test]
    fn contexts_are_canonical_unsigned_64_bit_values() {
        assert!(valid_epoch("0") && valid_epoch("18446744073709551615"));
        for invalid in ["", "01", "-1", "1.5", "18446744073709551616", "1\n"] {
            assert!(!valid_epoch(invalid));
        }
    }
}
