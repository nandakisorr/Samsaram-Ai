/**
 * Audio utilities for base64 decoding and playback
 */

export class AudioUtils {
  /**
   * Convert base64 string to Audio object and play
   */
  static playBase64Audio(base64Audio: string, format: string = 'mp3'): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        // Decode base64 to binary
        const binaryString = atob(base64Audio);
        const bytes = new Uint8Array(binaryString.length);

        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }

        // Create blob and URL
        const mimeType = `audio/${format}`;
        const blob = new Blob([bytes], { type: mimeType });
        const url = URL.createObjectURL(blob);

        // Create and play audio
        const audio = new Audio(url);

        audio.onended = () => {
          URL.revokeObjectURL(url);
          resolve();
        };

        audio.onerror = () => {
          URL.revokeObjectURL(url);
          reject(new Error('Audio playback failed'));
        };

        audio.play().catch(reject);
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Convert base64 to blob URL (for reuse)
   */
  static base64ToBlobUrl(base64Audio: string, format: string = 'mp3'): string {
    const binaryString = atob(base64Audio);
    const bytes = new Uint8Array(binaryString.length);

    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    const blob = new Blob([bytes], { type: `audio/${format}` });
    return URL.createObjectURL(blob);
  }

  /**
   * Clean up blob URL
   */
  static revokeBlobUrl(url: string): void {
    URL.revokeObjectURL(url);
  }

  /**
   * Convert base64 to downloadable file
   */
  static downloadAudio(base64Audio: string, filename: string = 'speech.mp3'): void {
    const binaryString = atob(base64Audio);
    const bytes = new Uint8Array(binaryString.length);

    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    const blob = new Blob([bytes], { type: 'audio/mpeg' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
}

export default AudioUtils;
