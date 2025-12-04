// Helper do obsługi desktop notifications
export class NotificationManager {
  private static instance: NotificationManager;
  private permission: NotificationPermission = "default";
  private initialized: boolean = false;

  private constructor() {
    // Don't initialize immediately - wait for first use
  }

  public static getInstance(): NotificationManager {
    if (!NotificationManager.instance) {
      NotificationManager.instance = new NotificationManager();
    }
    return NotificationManager.instance;
  }

  private async checkPermission(): Promise<void> {
    if (typeof window === "undefined") {
      return;
    }

    if (!("Notification" in window)) {
      console.warn("Ten przeglądarka nie obsługuje desktop notifications");
      return;
    }

    this.permission = Notification.permission;

    if (this.permission === "default") {
      try {
        this.permission = await Notification.requestPermission();
      } catch (error) {
        console.warn(
          "Nie udało się poprosić o uprawnienia do notifications:",
          error
        );
      }
    }
  }

  private async ensureInitialized(): Promise<void> {
    if (!this.initialized && typeof window !== "undefined") {
      await this.checkPermission();
      this.initialized = true;
    }
  }

  public async requestPermission(): Promise<boolean> {
    await this.ensureInitialized();

    if (typeof window === "undefined" || !("Notification" in window)) {
      return false;
    }

    try {
      this.permission = await Notification.requestPermission();
      return this.permission === "granted";
    } catch (error) {
      console.warn("Błąd podczas prośby o uprawnienia:", error);
      return false;
    }
  }

  public canSendNotifications(): boolean {
    if (typeof window === "undefined") {
      return false;
    }
    return "Notification" in window && this.permission === "granted";
  }

  public async sendNotification(
    title: string,
    options?: NotificationOptions
  ): Promise<void> {
    await this.ensureInitialized();

    if (!this.canSendNotifications()) {
      console.warn("Brak uprawnień do wysyłania notifications");
      return;
    }

    try {
      const notification = new Notification(title, {
        icon: "/favicon.ico",
        badge: "/favicon.ico",
        tag: "upload-notification",
        requireInteraction: false,
        silent: false,
        ...options,
      });

      // Automatyczne zamknięcie po 5 sekundach
      setTimeout(() => {
        notification.close();
      }, 5000);

      // Obsługa kliknięcia
      notification.onclick = () => {
        if (typeof window !== "undefined") {
          window.focus();
        }
        notification.close();
      };
    } catch (error) {
      console.warn("Błąd podczas wysyłania notification:", error);
    }
  }

  public async notifyUploadComplete(fileName: string): Promise<void> {
    await this.sendNotification("Upload zakończony", {
      body: `Plik "${fileName}" został pomyślnie przesłany`,
      icon: "/favicon.ico",
    });
  }

  public async notifyUploadError(
    fileName: string,
    error: string
  ): Promise<void> {
    await this.sendNotification("Błąd uploadu", {
      body: `Nie udało się przesłać pliku "${fileName}": ${error}`,
      icon: "/favicon.ico",
    });
  }

  public async notifyUploadProgress(
    fileName: string,
    progress: number
  ): Promise<void> {
    // Wysyłaj notification tylko przy 100% (zakończenie)
    if (progress >= 100) {
      await this.notifyUploadComplete(fileName);
    }
  }
}

// Eksport singleton instance
export const notificationManager = NotificationManager.getInstance();
