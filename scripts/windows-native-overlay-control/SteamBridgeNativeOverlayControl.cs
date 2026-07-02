using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Drawing;
using System.Drawing.Imaging;
using System.IO;
using System.Runtime.InteropServices;
using System.Text;
using System.Windows.Forms;

namespace SteamBridgeNativeOverlayControl
{
    internal static class Program
    {
        [STAThread]
        private static int Main(string[] args)
        {
            Options options = Options.Parse(args);
            RunState state = new RunState(options);
            int exitCode = 0;

            try
            {
                Directory.CreateDirectory(options.ScreenshotDir);
                string resultParent = Path.GetDirectoryName(options.ResultFile);
                if (!String.IsNullOrEmpty(resultParent))
                {
                    Directory.CreateDirectory(resultParent);
                }
                WriteSteamAppIdFile(options.AppId);

                Environment.SetEnvironmentVariable("SteamAppId", options.AppId.ToString());
                Environment.SetEnvironmentVariable("SteamGameId", options.AppId.ToString());
                Environment.SetEnvironmentVariable("SteamOverlayGameId", options.AppId.ToString());

                SteamApi.Init(state);

                Application.EnableVisualStyles();
                Application.SetCompatibleTextRenderingDefault(false);

                using (NativeOpenGlForm form = new NativeOpenGlForm(options))
                {
                    Stopwatch stopwatch = Stopwatch.StartNew();
                    Application.Idle += delegate
                    {
                        while (NativeMethods.AppStillIdle())
                        {
                            double seconds = stopwatch.Elapsed.TotalSeconds;
                            form.RenderFrame(seconds);
                            state.FrameRendered(stopwatch.ElapsedMilliseconds);
                            SteamApi.RunCallbacks();
                            state.Tick(stopwatch.ElapsedMilliseconds, form);
                            if (stopwatch.Elapsed.TotalSeconds >= options.ObserveSeconds)
                            {
                                form.Close();
                                break;
                            }
                        }
                    };
                    Application.Run(form);
                }
            }
            catch (Exception error)
            {
                exitCode = 1;
                state.RecordException(error);
            }
            finally
            {
                try
                {
                    SteamApi.Shutdown();
                    state.WriteResult(exitCode);
                }
                catch
                {
                }
            }

            return exitCode;
        }

        private static void WriteSteamAppIdFile(int appId)
        {
            string path = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "steam_appid.txt");
            File.WriteAllText(path, appId.ToString() + Environment.NewLine, Encoding.ASCII);
        }
    }

    internal sealed class Options
    {
        public int AppId = 480;
        public string Action = "user";
        public string Dialog = "Friends";
        public string UserDialog = "steamid";
        public string Url = "";
        public int Width = 960;
        public int Height = 540;
        public int ObserveSeconds = 18;
        public int OverlayReadyTimeoutSeconds = 12;
        public string ResultFile = Path.Combine(Path.GetTempPath(), "steam-bridge-native-overlay-control-result.json");
        public string ScreenshotDir = Path.Combine(Path.GetTempPath(), "steam-bridge-native-overlay-control");
        public string Title = "Steam Bridge Native Overlay Control";
        public string EnvFile = "";

        public static Options Parse(string[] args)
        {
            Options options = new Options();
            for (int index = 0; index < args.Length; index++)
            {
                string raw = args[index] ?? "";
                string name;
                string value;
                SplitArg(raw, out name, out value);
                if (value == null && index + 1 < args.Length && !args[index + 1].StartsWith("--", StringComparison.Ordinal))
                {
                    value = args[++index];
                }
                if (value == null)
                {
                    value = "";
                }

                switch (name)
                {
                    case "--app-id":
                        options.AppId = ParseInt(value, options.AppId);
                        break;
                    case "--action":
                        options.Action = value;
                        break;
                    case "--dialog":
                        options.Dialog = value;
                        break;
                    case "--user-dialog":
                        options.UserDialog = value;
                        break;
                    case "--url":
                        options.Url = value;
                        break;
                    case "--width":
                        options.Width = ParseInt(value, options.Width);
                        break;
                    case "--height":
                        options.Height = ParseInt(value, options.Height);
                        break;
                    case "--observe-seconds":
                        options.ObserveSeconds = ParseInt(value, options.ObserveSeconds);
                        break;
                    case "--overlay-ready-timeout-seconds":
                        options.OverlayReadyTimeoutSeconds = ParseInt(value, options.OverlayReadyTimeoutSeconds);
                        break;
                    case "--result-file":
                        options.ResultFile = value;
                        break;
                    case "--screenshot-dir":
                        options.ScreenshotDir = value;
                        break;
                    case "--title":
                        options.Title = value;
                        break;
                    case "--env-file":
                        options.EnvFile = value;
                        break;
                }
            }

            if (!String.IsNullOrWhiteSpace(options.EnvFile))
            {
                ApplyEnvFile(options, options.EnvFile);
            }

            if (String.IsNullOrWhiteSpace(options.Url))
            {
                options.Url = "https://steamcommunity.com/app/" + options.AppId.ToString();
            }
            if (options.ObserveSeconds < 4)
            {
                options.ObserveSeconds = 4;
            }
            if (options.OverlayReadyTimeoutSeconds < 1)
            {
                options.OverlayReadyTimeoutSeconds = 1;
            }
            return options;
        }

        private static void SplitArg(string raw, out string name, out string value)
        {
            int equals = raw.IndexOf('=');
            if (equals < 0)
            {
                name = raw;
                value = null;
                return;
            }
            name = raw.Substring(0, equals);
            value = raw.Substring(equals + 1);
        }

        private static int ParseInt(string value, int fallback)
        {
            int parsed;
            return Int32.TryParse(value, out parsed) ? parsed : fallback;
        }

        private static void ApplyEnvFile(Options options, string path)
        {
            if (!File.Exists(path))
            {
                return;
            }

            foreach (string rawLine in File.ReadAllLines(path))
            {
                string line = rawLine.Trim();
                if (line.Length == 0 || line.StartsWith("#", StringComparison.Ordinal))
                {
                    continue;
                }

                int equals = line.IndexOf('=');
                if (equals < 0)
                {
                    continue;
                }

                string key = line.Substring(0, equals).Trim();
                string value = line.Substring(equals + 1).Trim();
                switch (key)
                {
                    case "STEAM_BRIDGE_NATIVE_OVERLAY_APP_ID":
                        options.AppId = ParseInt(value, options.AppId);
                        break;
                    case "STEAM_BRIDGE_NATIVE_OVERLAY_ACTION":
                        options.Action = value;
                        break;
                    case "STEAM_BRIDGE_NATIVE_OVERLAY_URL":
                        options.Url = value;
                        break;
                    case "STEAM_BRIDGE_NATIVE_OVERLAY_DIALOG":
                        options.Dialog = value;
                        break;
                    case "STEAM_BRIDGE_NATIVE_OVERLAY_USER_DIALOG":
                        options.UserDialog = value;
                        break;
                    case "STEAM_BRIDGE_NATIVE_OVERLAY_OBSERVE_SECONDS":
                        options.ObserveSeconds = ParseInt(value, options.ObserveSeconds);
                        break;
                    case "STEAM_BRIDGE_NATIVE_OVERLAY_RESULT_FILE":
                        options.ResultFile = value;
                        break;
                    case "STEAM_BRIDGE_NATIVE_OVERLAY_SCREENSHOT_DIR":
                        options.ScreenshotDir = value;
                        break;
                    case "STEAM_BRIDGE_NATIVE_OVERLAY_TITLE":
                        options.Title = value;
                        break;
                }
            }
        }
    }

    internal sealed class RunState
    {
        private readonly Options options;
        private readonly List<string> eventsJson = new List<string>();
        private readonly List<string> screenshotsJson = new List<string>();
        private bool actionCalled;
        private bool beforeCaptured;
        private bool afterCaptured;
        private bool lateCaptured;
        private bool lastOverlayEnabled;
        private bool hasOverlaySample;
        private bool finalOverlayEnabled;
        private long firstFrameMs = -1;
        private long overlayEnabledAtMs = -1;
        private long actionAtMs = -1;
        private int frames;
        private string exceptionType = "";
        private string exceptionMessage = "";

        public RunState(Options options)
        {
            this.options = options;
            AddEvent("start", 0, "action", options.Action);
        }

        public int SteamInitResult;
        public string SteamInitError = "";
        public ulong SteamId64;
        public uint SteamAppId;

        public void FrameRendered(long elapsedMs)
        {
            frames++;
            if (firstFrameMs < 0)
            {
                firstFrameMs = elapsedMs;
                AddEvent("first-frame", elapsedMs, "frames", frames.ToString());
            }
        }

        public void Tick(long elapsedMs, NativeOpenGlForm form)
        {
            bool overlayEnabled = SteamApi.IsOverlayEnabled();
            finalOverlayEnabled = overlayEnabled;
            if (!hasOverlaySample || overlayEnabled != lastOverlayEnabled)
            {
                hasOverlaySample = true;
                lastOverlayEnabled = overlayEnabled;
                AddEvent("overlay-enabled-sample", elapsedMs, "enabled", overlayEnabled ? "true" : "false");
            }
            if (overlayEnabled && overlayEnabledAtMs < 0)
            {
                overlayEnabledAtMs = elapsedMs;
            }

            if (!beforeCaptured && elapsedMs >= 700)
            {
                beforeCaptured = true;
                CaptureScreenshot("before-action", elapsedMs, form);
            }

            if (!actionCalled && ShouldCallAction(elapsedMs, overlayEnabled))
            {
                actionCalled = true;
                actionAtMs = elapsedMs;
                AddEvent("action", elapsedMs, "action", options.Action);
                SteamApi.OpenOverlay(options);
            }

            if (actionCalled && !afterCaptured && elapsedMs >= actionAtMs + 2500)
            {
                afterCaptured = true;
                CaptureScreenshot("after-action", elapsedMs, form);
            }
            if (actionCalled && !lateCaptured && elapsedMs >= actionAtMs + 8000)
            {
                lateCaptured = true;
                CaptureScreenshot("late-action", elapsedMs, form);
            }
        }

        public void RecordSteamInit(int result, string error)
        {
            SteamInitResult = result;
            SteamInitError = error ?? "";
            AddEvent("steam-init", 0, "result", result.ToString());
        }

        public void RecordSteamIdentity(ulong steamId64, uint appId)
        {
            SteamId64 = steamId64;
            SteamAppId = appId;
            AddEvent("steam-identity", 0, "steamId64", steamId64.ToString());
        }

        public void RecordException(Exception error)
        {
            exceptionType = error.GetType().FullName;
            exceptionMessage = error.Message;
            AddEvent("exception", 0, "message", error.Message);
        }

        public void WriteResult(int exitCode)
        {
            StringBuilder builder = new StringBuilder();
            builder.AppendLine("{");
            AppendJsonProperty(builder, "kind", "steam-bridge-windows-native-overlay-control", true);
            AppendJsonProperty(builder, "action", options.Action, true);
            AppendJsonProperty(builder, "appId", options.AppId, true);
            AppendJsonProperty(builder, "steamInitResult", SteamInitResult, true);
            AppendJsonProperty(builder, "steamInitOk", SteamInitResult == 0, true);
            AppendJsonProperty(builder, "steamInitError", SteamInitError, true);
            AppendJsonProperty(builder, "steamId64", SteamId64.ToString(), true);
            AppendJsonProperty(builder, "steamAppId", SteamAppId, true);
            AppendJsonProperty(builder, "overlayEnabledAtMs", overlayEnabledAtMs, true);
            AppendJsonProperty(builder, "finalOverlayEnabled", finalOverlayEnabled, true);
            AppendJsonProperty(builder, "actionCalled", actionCalled, true);
            AppendJsonProperty(builder, "actionAtMs", actionAtMs, true);
            AppendJsonProperty(builder, "firstFrameMs", firstFrameMs, true);
            AppendJsonProperty(builder, "frames", frames, true);
            AppendJsonProperty(builder, "exitCode", exitCode, true);
            AppendJsonProperty(builder, "exceptionType", exceptionType, true);
            AppendJsonProperty(builder, "exceptionMessage", exceptionMessage, true);
            builder.Append("  \"screenshots\": [");
            builder.Append(String.Join(", ", screenshotsJson.ToArray()));
            builder.AppendLine("],");
            builder.Append("  \"events\": [");
            builder.Append(String.Join(", ", eventsJson.ToArray()));
            builder.AppendLine("]");
            builder.AppendLine("}");
            File.WriteAllText(options.ResultFile, builder.ToString(), new UTF8Encoding(false));
        }

        private bool ShouldCallAction(long elapsedMs, bool overlayEnabled)
        {
            if (String.Equals(options.Action, "none", StringComparison.OrdinalIgnoreCase))
            {
                return false;
            }
            if (overlayEnabled)
            {
                return true;
            }
            return elapsedMs >= options.OverlayReadyTimeoutSeconds * 1000L;
        }

        private void CaptureScreenshot(string label, long elapsedMs, NativeOpenGlForm form)
        {
            string desktopPath = Path.Combine(options.ScreenshotDir, label + "-desktop.png");
            string clientPath = Path.Combine(options.ScreenshotDir, label + "-client.png");
            CaptureDesktop(desktopPath);
            form.CaptureClient(clientPath);
            screenshotsJson.Add("{\"label\":" + JsonString(label) + ",\"elapsedMs\":" + elapsedMs.ToString() + ",\"desktop\":" + JsonString(desktopPath) + ",\"client\":" + JsonString(clientPath) + "}");
            AddEvent("screenshot", elapsedMs, "label", label);
        }

        private static void CaptureDesktop(string path)
        {
            Rectangle bounds = Screen.PrimaryScreen.Bounds;
            using (Bitmap bitmap = new Bitmap(bounds.Width, bounds.Height))
            using (Graphics graphics = Graphics.FromImage(bitmap))
            {
                graphics.CopyFromScreen(bounds.Location, Point.Empty, bounds.Size);
                bitmap.Save(path, ImageFormat.Png);
            }
        }

        private void AddEvent(string type, long elapsedMs, string key, string value)
        {
            eventsJson.Add("{\"type\":" + JsonString(type) + ",\"elapsedMs\":" + elapsedMs.ToString() + ",\"" + JsonEscape(key) + "\":" + JsonString(value) + "}");
        }

        private static void AppendJsonProperty(StringBuilder builder, string name, string value, bool comma)
        {
            builder.Append("  \"");
            builder.Append(JsonEscape(name));
            builder.Append("\": ");
            builder.Append(JsonString(value));
            if (comma)
            {
                builder.Append(",");
            }
            builder.AppendLine();
        }

        private static void AppendJsonProperty(StringBuilder builder, string name, int value, bool comma)
        {
            builder.Append("  \"");
            builder.Append(JsonEscape(name));
            builder.Append("\": ");
            builder.Append(value.ToString());
            if (comma)
            {
                builder.Append(",");
            }
            builder.AppendLine();
        }

        private static void AppendJsonProperty(StringBuilder builder, string name, long value, bool comma)
        {
            builder.Append("  \"");
            builder.Append(JsonEscape(name));
            builder.Append("\": ");
            builder.Append(value.ToString());
            if (comma)
            {
                builder.Append(",");
            }
            builder.AppendLine();
        }

        private static void AppendJsonProperty(StringBuilder builder, string name, bool value, bool comma)
        {
            builder.Append("  \"");
            builder.Append(JsonEscape(name));
            builder.Append("\": ");
            builder.Append(value ? "true" : "false");
            if (comma)
            {
                builder.Append(",");
            }
            builder.AppendLine();
        }

        private static string JsonString(string value)
        {
            return "\"" + JsonEscape(value ?? "") + "\"";
        }

        private static string JsonEscape(string value)
        {
            StringBuilder builder = new StringBuilder();
            for (int index = 0; index < value.Length; index++)
            {
                char c = value[index];
                switch (c)
                {
                    case '\\':
                        builder.Append("\\\\");
                        break;
                    case '"':
                        builder.Append("\\\"");
                        break;
                    case '\r':
                        builder.Append("\\r");
                        break;
                    case '\n':
                        builder.Append("\\n");
                        break;
                    case '\t':
                        builder.Append("\\t");
                        break;
                    default:
                        if (c < 32)
                        {
                            builder.Append("\\u");
                            builder.Append(((int)c).ToString("x4"));
                        }
                        else
                        {
                            builder.Append(c);
                        }
                        break;
                }
            }
            return builder.ToString();
        }
    }

    internal sealed class NativeOpenGlForm : Form
    {
        private readonly Options options;
        private IntPtr deviceContext = IntPtr.Zero;
        private IntPtr renderContext = IntPtr.Zero;

        public NativeOpenGlForm(Options options)
        {
            this.options = options;
            Text = options.Title;
            ClientSize = new Size(options.Width, options.Height);
            StartPosition = FormStartPosition.CenterScreen;
            BackColor = Color.Black;
        }

        protected override void OnShown(EventArgs e)
        {
            base.OnShown(e);
            InitOpenGl();
            Activate();
        }

        protected override void OnFormClosed(FormClosedEventArgs e)
        {
            if (renderContext != IntPtr.Zero)
            {
                NativeMethods.wglMakeCurrent(IntPtr.Zero, IntPtr.Zero);
                NativeMethods.wglDeleteContext(renderContext);
                renderContext = IntPtr.Zero;
            }
            if (deviceContext != IntPtr.Zero)
            {
                NativeMethods.ReleaseDC(Handle, deviceContext);
                deviceContext = IntPtr.Zero;
            }
            base.OnFormClosed(e);
        }

        public void RenderFrame(double seconds)
        {
            if (renderContext == IntPtr.Zero)
            {
                return;
            }
            NativeMethods.wglMakeCurrent(deviceContext, renderContext);
            double wave = (Math.Sin(seconds * 1.7) + 1.0) * 0.5;
            float red = (float)(0.10 + wave * 0.35);
            float green = (float)(0.18 + (1.0 - wave) * 0.28);
            float blue = 0.32f;
            NativeMethods.glViewport(0, 0, ClientSize.Width, ClientSize.Height);
            NativeMethods.glClearColor(red, green, blue, 1.0f);
            NativeMethods.glClear(NativeMethods.GL_COLOR_BUFFER_BIT);
            NativeMethods.SwapBuffers(deviceContext);
        }

        public void CaptureClient(string path)
        {
            Rectangle bounds = RectangleToScreen(ClientRectangle);
            using (Bitmap bitmap = new Bitmap(bounds.Width, bounds.Height))
            using (Graphics graphics = Graphics.FromImage(bitmap))
            {
                graphics.CopyFromScreen(bounds.Location, Point.Empty, bounds.Size);
                bitmap.Save(path, ImageFormat.Png);
            }
        }

        private void InitOpenGl()
        {
            deviceContext = NativeMethods.GetDC(Handle);
            NativeMethods.PIXELFORMATDESCRIPTOR descriptor = NativeMethods.PIXELFORMATDESCRIPTOR.Create();
            int pixelFormat = NativeMethods.ChoosePixelFormat(deviceContext, ref descriptor);
            if (pixelFormat == 0)
            {
                throw new InvalidOperationException("ChoosePixelFormat failed.");
            }
            if (!NativeMethods.SetPixelFormat(deviceContext, pixelFormat, ref descriptor))
            {
                throw new InvalidOperationException("SetPixelFormat failed.");
            }
            renderContext = NativeMethods.wglCreateContext(deviceContext);
            if (renderContext == IntPtr.Zero)
            {
                throw new InvalidOperationException("wglCreateContext failed.");
            }
            if (!NativeMethods.wglMakeCurrent(deviceContext, renderContext))
            {
                throw new InvalidOperationException("wglMakeCurrent failed.");
            }
        }
    }

    internal static class SteamApi
    {
        private static IntPtr friends = IntPtr.Zero;
        private static IntPtr utils = IntPtr.Zero;
        private static IntPtr user = IntPtr.Zero;
        private static bool initialized;

        public static void Init(RunState state)
        {
            byte[] error = new byte[1024];
            int result = SteamAPI_InitFlat(error);
            state.RecordSteamInit(result, DecodeCString(error));
            initialized = result == 0;
            if (!initialized)
            {
                return;
            }

            friends = SteamAPI_SteamFriends_v018();
            utils = SteamAPI_SteamUtils_v010();
            user = SteamAPI_SteamUser_v023();
            ulong steamId64 = user == IntPtr.Zero ? 0UL : SteamAPI_ISteamUser_GetSteamID(user);
            uint appId = utils == IntPtr.Zero ? 0U : SteamAPI_ISteamUtils_GetAppID(utils);
            state.RecordSteamIdentity(steamId64, appId);
        }

        public static void RunCallbacks()
        {
            if (initialized)
            {
                SteamAPI_RunCallbacks();
            }
        }

        public static void Shutdown()
        {
            if (initialized)
            {
                SteamAPI_Shutdown();
            }
            initialized = false;
        }

        public static bool IsOverlayEnabled()
        {
            return initialized && utils != IntPtr.Zero && SteamAPI_ISteamUtils_IsOverlayEnabled(utils);
        }

        public static void OpenOverlay(Options options)
        {
            if (!initialized || friends == IntPtr.Zero)
            {
                return;
            }

            string action = options.Action.ToLowerInvariant();
            if (action == "store")
            {
                SteamAPI_ISteamFriends_ActivateGameOverlayToStore(friends, (uint)options.AppId, 0);
            }
            else if (action == "web")
            {
                SteamAPI_ISteamFriends_ActivateGameOverlayToWebPage(friends, options.Url, 1);
            }
            else if (action == "friends")
            {
                SteamAPI_ISteamFriends_ActivateGameOverlay(friends, "Friends");
            }
            else if (action == "dialog")
            {
                SteamAPI_ISteamFriends_ActivateGameOverlay(friends, options.Dialog);
            }
            else if (action == "user")
            {
                ulong steamId64 = user == IntPtr.Zero ? 0UL : SteamAPI_ISteamUser_GetSteamID(user);
                SteamAPI_ISteamFriends_ActivateGameOverlayToUser(friends, options.UserDialog, steamId64);
            }
        }

        private static string DecodeCString(byte[] buffer)
        {
            int length = 0;
            while (length < buffer.Length && buffer[length] != 0)
            {
                length++;
            }
            return Encoding.UTF8.GetString(buffer, 0, length);
        }

        [DllImport("steam_api64.dll", CallingConvention = CallingConvention.Cdecl)]
        private static extern int SteamAPI_InitFlat(byte[] pOutErrMsg);

        [DllImport("steam_api64.dll", CallingConvention = CallingConvention.Cdecl)]
        private static extern void SteamAPI_RunCallbacks();

        [DllImport("steam_api64.dll", CallingConvention = CallingConvention.Cdecl)]
        private static extern void SteamAPI_Shutdown();

        [DllImport("steam_api64.dll", CallingConvention = CallingConvention.Cdecl, EntryPoint = "SteamAPI_SteamFriends_v018")]
        private static extern IntPtr SteamAPI_SteamFriends_v018();

        [DllImport("steam_api64.dll", CallingConvention = CallingConvention.Cdecl, EntryPoint = "SteamAPI_SteamUtils_v010")]
        private static extern IntPtr SteamAPI_SteamUtils_v010();

        [DllImport("steam_api64.dll", CallingConvention = CallingConvention.Cdecl, EntryPoint = "SteamAPI_SteamUser_v023")]
        private static extern IntPtr SteamAPI_SteamUser_v023();

        [DllImport("steam_api64.dll", CallingConvention = CallingConvention.Cdecl)]
        private static extern ulong SteamAPI_ISteamUser_GetSteamID(IntPtr self);

        [DllImport("steam_api64.dll", CallingConvention = CallingConvention.Cdecl)]
        private static extern uint SteamAPI_ISteamUtils_GetAppID(IntPtr self);

        [DllImport("steam_api64.dll", CallingConvention = CallingConvention.Cdecl)]
        private static extern bool SteamAPI_ISteamUtils_IsOverlayEnabled(IntPtr self);

        [DllImport("steam_api64.dll", CallingConvention = CallingConvention.Cdecl)]
        private static extern void SteamAPI_ISteamFriends_ActivateGameOverlay(IntPtr self, [MarshalAs(UnmanagedType.LPStr)] string dialog);

        [DllImport("steam_api64.dll", CallingConvention = CallingConvention.Cdecl)]
        private static extern void SteamAPI_ISteamFriends_ActivateGameOverlayToUser(IntPtr self, [MarshalAs(UnmanagedType.LPStr)] string dialog, ulong steamId);

        [DllImport("steam_api64.dll", CallingConvention = CallingConvention.Cdecl)]
        private static extern void SteamAPI_ISteamFriends_ActivateGameOverlayToWebPage(IntPtr self, [MarshalAs(UnmanagedType.LPStr)] string url, int mode);

        [DllImport("steam_api64.dll", CallingConvention = CallingConvention.Cdecl)]
        private static extern void SteamAPI_ISteamFriends_ActivateGameOverlayToStore(IntPtr self, uint appId, int flag);
    }

    internal static class NativeMethods
    {
        public const int GL_COLOR_BUFFER_BIT = 0x00004000;

        [StructLayout(LayoutKind.Sequential)]
        public struct PIXELFORMATDESCRIPTOR
        {
            public ushort nSize;
            public ushort nVersion;
            public uint dwFlags;
            public byte iPixelType;
            public byte cColorBits;
            public byte cRedBits;
            public byte cRedShift;
            public byte cGreenBits;
            public byte cGreenShift;
            public byte cBlueBits;
            public byte cBlueShift;
            public byte cAlphaBits;
            public byte cAlphaShift;
            public byte cAccumBits;
            public byte cAccumRedBits;
            public byte cAccumGreenBits;
            public byte cAccumBlueBits;
            public byte cAccumAlphaBits;
            public byte cDepthBits;
            public byte cStencilBits;
            public byte cAuxBuffers;
            public sbyte iLayerType;
            public byte bReserved;
            public uint dwLayerMask;
            public uint dwVisibleMask;
            public uint dwDamageMask;

            public static PIXELFORMATDESCRIPTOR Create()
            {
                PIXELFORMATDESCRIPTOR descriptor = new PIXELFORMATDESCRIPTOR();
                descriptor.nSize = (ushort)Marshal.SizeOf(typeof(PIXELFORMATDESCRIPTOR));
                descriptor.nVersion = 1;
                descriptor.dwFlags = 0x00000004 | 0x00000020 | 0x00000001;
                descriptor.iPixelType = 0;
                descriptor.cColorBits = 32;
                descriptor.cDepthBits = 24;
                descriptor.cStencilBits = 8;
                descriptor.iLayerType = 0;
                return descriptor;
            }
        }

        [StructLayout(LayoutKind.Sequential)]
        private struct MSG
        {
            public IntPtr hwnd;
            public uint message;
            public IntPtr wParam;
            public IntPtr lParam;
            public uint time;
            public Point pt;
        }

        public static bool AppStillIdle()
        {
            MSG msg;
            return !PeekMessage(out msg, IntPtr.Zero, 0, 0, 0);
        }

        [DllImport("user32.dll")]
        public static extern IntPtr GetDC(IntPtr hwnd);

        [DllImport("user32.dll")]
        public static extern int ReleaseDC(IntPtr hwnd, IntPtr hdc);

        [DllImport("user32.dll")]
        private static extern bool PeekMessage(out MSG message, IntPtr hwnd, uint filterMin, uint filterMax, uint flags);

        [DllImport("gdi32.dll")]
        public static extern int ChoosePixelFormat(IntPtr hdc, ref PIXELFORMATDESCRIPTOR ppfd);

        [DllImport("gdi32.dll")]
        public static extern bool SetPixelFormat(IntPtr hdc, int format, ref PIXELFORMATDESCRIPTOR ppfd);

        [DllImport("gdi32.dll")]
        public static extern bool SwapBuffers(IntPtr hdc);

        [DllImport("opengl32.dll")]
        public static extern IntPtr wglCreateContext(IntPtr hdc);

        [DllImport("opengl32.dll")]
        public static extern bool wglMakeCurrent(IntPtr hdc, IntPtr hglrc);

        [DllImport("opengl32.dll")]
        public static extern bool wglDeleteContext(IntPtr hglrc);

        [DllImport("opengl32.dll")]
        public static extern void glViewport(int x, int y, int width, int height);

        [DllImport("opengl32.dll")]
        public static extern void glClearColor(float red, float green, float blue, float alpha);

        [DllImport("opengl32.dll")]
        public static extern void glClear(int mask);
    }
}
