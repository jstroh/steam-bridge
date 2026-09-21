export class SharedTextureCopyAdmission {
  private inFlight = 0;
  private closed = false;
  private failed = false;
  private fullCopyRequired = false;
  private submitted = 0;
  private rejected = 0;

  enqueue(submit: (fullCopy: boolean) => Promise<boolean>): Promise<boolean> {
    if (this.closed || this.inFlight >= 2) {
      this.fullCopyRequired = true;
      this.rejected += 1;
      return Promise.resolve(false);
    }
    this.inFlight += 1;
    this.submitted += 1;
    const fullCopy = this.takeFullCopyRequired();
    let completion: Promise<boolean>;
    try {
      completion = submit(fullCopy);
    } catch (error) {
      this.fail();
      return Promise.reject(error);
    }
    return Promise.resolve(completion).then(accepted => {
      this.inFlight -= 1;
      if (!accepted) {
        this.fullCopyRequired = true;
        this.rejected += 1;
      }
      return accepted;
    }, error => {
      this.fail();
      throw error;
    });
  }

  invalidateDamage(): void {
    this.fullCopyRequired = true;
  }

  takeFullCopyRequired(): boolean {
    const required = this.fullCopyRequired;
    this.fullCopyRequired = false;
    return required;
  }

  close(): void {
    this.closed = true;
  }

  snapshot() {
    return {
      policy: "bounded-two-copy-admission" as const,
      inFlight: this.inFlight,
      pending: 0,
      submitted: this.submitted,
      rejected: this.rejected,
      replaced: 0,
      cancelled: 0,
      lastQueueDelayMs: 0,
      maxQueueDelayMs: 0,
      failed: this.failed,
    };
  }

  private fail(): void {
    this.inFlight -= 1;
    this.failed = true;
    this.fullCopyRequired = true;
  }
}
