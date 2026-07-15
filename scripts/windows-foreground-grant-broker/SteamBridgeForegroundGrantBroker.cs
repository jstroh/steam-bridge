using System;
using System.Diagnostics;
using System.Drawing;
using System.Globalization;
using System.IO;
using System.Linq;
using System.Runtime.InteropServices;
using System.Security.Cryptography;
using System.Windows.Forms;
using System.Web.Script.Serialization;

internal sealed class ForegroundGrantRequest {
  public string kind;
  public int schemaVersion;
  public string challenge;
  public string caseId;
  public string requestedAt;
  public string expiresAt;
  public int currentSessionId;
  public string brokerSha256;
  public string inputTarget;
  public bool candidateInputAllowed;
}

internal sealed class ForegroundGrantAcknowledgement {
  public string kind;
  public int schemaVersion;
  public string challenge;
  public string caseId;
  public string acknowledgedAt;
  public int brokerPid;
  public int brokerSessionId;
  public long brokerStartUtcTicks;
  public string brokerSha256;
  public long foregroundHandle;
  public bool foregroundOwned;
  public bool allowSetForegroundWindowResult;
  public int lastError;
  public string inputTarget;
  public bool candidateInputSent;
}

internal sealed class ForegroundGrantForm : Form {
  private const uint AsfwAny = 0xFFFFFFFF;
  private readonly string requestPath;
  private readonly string acknowledgementPath;
  private readonly string executableSha256;
  private readonly JavaScriptSerializer serializer = new JavaScriptSerializer();
  private readonly Label status = new Label();
  private readonly Button grant = new Button();
  private readonly Timer timer = new Timer();
  private ForegroundGrantRequest request;
  private string acknowledgedChallenge = "";

  [DllImport("user32.dll")]
  private static extern IntPtr GetForegroundWindow();

  [DllImport("user32.dll", SetLastError = true)]
  [return: MarshalAs(UnmanagedType.Bool)]
  private static extern bool AllowSetForegroundWindow(uint processId);

  public ForegroundGrantForm() {
    Text = "Steam Bridge Foreground Grant";
    ClientSize = new Size(520, 190);
    MinimumSize = new Size(520, 190);
    StartPosition = FormStartPosition.CenterScreen;
    FormBorderStyle = FormBorderStyle.FixedDialog;
    MaximizeBox = false;
    MinimizeBox = false;

    string directory = Path.GetDirectoryName(Application.ExecutablePath);
    requestPath = Path.Combine(directory, "request.json");
    acknowledgementPath = Path.Combine(directory, "ack.json");
    executableSha256 = ComputeSha256(Application.ExecutablePath);

    status.AutoSize = false;
    status.Location = new Point(20, 20);
    status.Size = new Size(480, 72);
    status.Text = "Waiting for a Steam Bridge launch request.";

    grant.Location = new Point(145, 112);
    grant.Size = new Size(230, 42);
    grant.Text = "Grant foreground launch";
    grant.Enabled = false;
    grant.Click += GrantClick;

    Controls.Add(status);
    Controls.Add(grant);

    Shown += delegate {
      Activate();
      BringToFront();
    };

    timer.Interval = 100;
    timer.Tick += RefreshRequest;
    timer.Start();
  }

  private void RefreshRequest(object sender, EventArgs args) {
    ForegroundGrantRequest candidate = null;
    string invalidReason = "request-missing";
    try {
      if (File.Exists(requestPath)) {
        candidate = serializer.Deserialize<ForegroundGrantRequest>(File.ReadAllText(requestPath));
      }
    } catch {
      candidate = null;
      invalidReason = "request-read-failed";
    }

    bool valid = invalidReason != "request-read-failed" && ValidateRequest(candidate, out invalidReason);

    request = valid ? candidate : null;
    bool alreadyAcknowledged = request != null && request.challenge == acknowledgedChallenge;
    grant.Enabled = request != null && !alreadyAcknowledged;
    status.Text = request == null
      ? "Waiting for a valid Steam Bridge launch request. Reason: " + invalidReason + "."
      : alreadyAcknowledged
        ? "Foreground launch granted. Waiting for the next case."
        : "Ready for case " + request.caseId + ". No input will be sent to the candidate.";
  }

  private bool ValidateRequest(ForegroundGrantRequest candidate, out string reason) {
    DateTime requestedAt;
    DateTime expiresAt;
    if (candidate == null) { reason = "request-missing"; return false; }
    if (candidate.kind != "steam-bridge-windows-foreground-grant-request") { reason = "kind"; return false; }
    if (candidate.schemaVersion != 1) { reason = "schema"; return false; }
    if (String.IsNullOrWhiteSpace(candidate.challenge) || candidate.challenge.Length != 32 || !candidate.challenge.All(Uri.IsHexDigit)) { reason = "challenge"; return false; }
    if (String.IsNullOrWhiteSpace(candidate.caseId)) { reason = "case"; return false; }
    if (candidate.currentSessionId != Process.GetCurrentProcess().SessionId) { reason = "session"; return false; }
    if (!String.Equals(candidate.brokerSha256, executableSha256, StringComparison.Ordinal)) { reason = "broker-hash"; return false; }
    if (candidate.inputTarget != "broker-button") { reason = "input-target"; return false; }
    if (candidate.candidateInputAllowed) { reason = "candidate-input"; return false; }
    if (!DateTime.TryParse(candidate.requestedAt, null, DateTimeStyles.AdjustToUniversal, out requestedAt)) { reason = "requested-at"; return false; }
    if (!DateTime.TryParse(candidate.expiresAt, null, DateTimeStyles.AdjustToUniversal, out expiresAt)) { reason = "expires-at"; return false; }
    if (requestedAt.ToUniversalTime() > DateTime.UtcNow) { reason = "requested-in-future"; return false; }
    if (expiresAt.ToUniversalTime() < DateTime.UtcNow) { reason = "expired"; return false; }
    if (expiresAt.ToUniversalTime() <= requestedAt.ToUniversalTime()) { reason = "invalid-interval"; return false; }
    reason = "valid";
    return true;
  }

  private void GrantClick(object sender, EventArgs args) {
    if (request == null || request.challenge == acknowledgedChallenge) {
      return;
    }

    IntPtr foreground = GetForegroundWindow();
    bool foregroundOwned = foreground == Handle;
    bool granted = foregroundOwned && AllowSetForegroundWindow(AsfwAny);
    int lastError = granted ? 0 : Marshal.GetLastWin32Error();
    Process process = Process.GetCurrentProcess();
    ForegroundGrantAcknowledgement acknowledgement = new ForegroundGrantAcknowledgement {
      kind = "steam-bridge-windows-foreground-grant-ack",
      schemaVersion = 1,
      challenge = request.challenge,
      caseId = request.caseId,
      acknowledgedAt = DateTime.UtcNow.ToString("o"),
      brokerPid = process.Id,
      brokerSessionId = process.SessionId,
      brokerStartUtcTicks = process.StartTime.ToUniversalTime().Ticks,
      brokerSha256 = executableSha256,
      foregroundHandle = foreground.ToInt64(),
      foregroundOwned = foregroundOwned,
      allowSetForegroundWindowResult = granted,
      lastError = lastError,
      inputTarget = "broker-button",
      candidateInputSent = false
    };
    File.WriteAllText(acknowledgementPath, serializer.Serialize(acknowledgement));
    acknowledgedChallenge = request.challenge;
    grant.Enabled = false;
    status.Text = granted
      ? "Foreground launch granted. Waiting for the next case."
      : "Windows rejected the foreground grant. The matrix will fail closed.";
  }

  private static string ComputeSha256(string path) {
    using (SHA256 sha256 = SHA256.Create())
    using (FileStream stream = File.OpenRead(path)) {
      return String.Concat(sha256.ComputeHash(stream).Select(value => value.ToString("x2")));
    }
  }
}

internal static class Program {
  [STAThread]
  private static void Main() {
    Application.EnableVisualStyles();
    Application.SetCompatibleTextRenderingDefault(false);
    Application.Run(new ForegroundGrantForm());
  }
}
