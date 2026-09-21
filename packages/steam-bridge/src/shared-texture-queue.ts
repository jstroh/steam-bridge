type Submission = {
  submit(fullCopy: boolean): Promise<boolean>;
  resolve(accepted: boolean): void;
  reject(error: unknown): void;
  receivedAt: number;
};

export class LatestSharedTextureQueue {
  private active = false;
  private pending: Submission | undefined;
  private closed = false;
  private failed = false;
  private fullCopyRequired = false;
  private submitted = 0;
  private replaced = 0;
  private cancelled = 0;
  private lastQueueDelayMs = 0;
  private maxQueueDelayMs = 0;

  constructor(private readonly now: () => number = () => performance.now()) {}

  enqueue(submit: Submission["submit"]): Promise<boolean> {
    if (this.closed) return Promise.resolve(false);
    return new Promise<boolean>((resolve, reject) => {
      const submission = { submit, resolve, reject, receivedAt: this.now() };
      if (this.active) {
        if (this.pending) {
          this.pending.resolve(false);
          this.replaced += 1;
          this.fullCopyRequired = true;
        }
        this.pending = submission;
      } else {
        this.start(submission);
      }
    });
  }

  discardPending(): void {
    this.fullCopyRequired = true;
    if (!this.pending) return;
    const pending = this.pending;
    this.pending = undefined;
    this.cancelled += 1;
    pending.resolve(false);
  }

  close(): void {
    this.closed = true;
    this.discardPending();
  }

  snapshot() {
    return {
      inFlight: this.active ? 1 : 0,
      pending: this.pending ? 1 : 0,
      submitted: this.submitted,
      replaced: this.replaced,
      cancelled: this.cancelled,
      lastQueueDelayMs: this.lastQueueDelayMs,
      maxQueueDelayMs: this.maxQueueDelayMs,
      failed: this.failed,
    };
  }

  private start(submission: Submission): void {
    this.active = true;
    this.submitted += 1;
    this.lastQueueDelayMs = Math.max(0, this.now() - submission.receivedAt);
    this.maxQueueDelayMs = Math.max(this.maxQueueDelayMs, this.lastQueueDelayMs);
    const fullCopy = this.fullCopyRequired;
    this.fullCopyRequired = false;
    let completion: Promise<boolean>;
    try {
      completion = submission.submit(fullCopy);
    } catch (error) {
      this.fail(submission, error);
      return;
    }
    Promise.resolve(completion).then(accepted => {
      this.active = false;
      if (!accepted) this.fullCopyRequired = true;
      submission.resolve(accepted);
      const next = this.pending;
      this.pending = undefined;
      if (next) this.start(next);
    }, error => this.fail(submission, error));
  }

  private fail(submission: Submission, error: unknown): void {
    this.active = false;
    this.failed = true;
    this.discardPending();
    submission.reject(error);
  }
}
