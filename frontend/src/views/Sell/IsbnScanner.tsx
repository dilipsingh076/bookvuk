"use client";

/**
 * Reading the barcode off the back of a book.
 *
 * Typing a title, an author and an MRP is the whole cost of the sell flow, and
 * it is what makes somebody stop after two books. Every book printed since the
 * seventies carries its ISBN as a barcode; pointing the camera at it is a second
 * per book instead of a minute.
 *
 * Uses the browser's own `BarcodeDetector` rather than a library. It ships in
 * Chrome on Android — which is most of this shop's sellers — and where it is
 * absent (Safari, older browsers) this component renders nothing at all and the
 * form is typed as before. That is the honest trade: a 300 KB decoder shipped to
 * everybody to serve the browsers that lack a free one is a worse deal than
 * letting those people type.
 */

import { useEffect, useRef, useState } from "react";
import { Button } from "../../components/ui";

type DetectedBarcode = { rawValue: string; format: string };
type Detector = { detect: (source: CanvasImageSource) => Promise<DetectedBarcode[]> };

/** Book barcodes are EAN-13; ISBN-10 books also carry EAN-8 occasionally. */
const FORMATS = ["ean_13", "ean_8"];

const barcodeScanningAvailable = (): boolean =>
  typeof window !== "undefined" && "BarcodeDetector" in window;

/** A 13-digit EAN is an ISBN when it starts 978 or 979. Anything else on a book
 *  jacket is a price or a stock code, and treating it as an ISBN would look up
 *  the wrong thing — or nothing, confusingly. */
const asIsbn = (raw: string): string | null => {
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 13 && (digits.startsWith("978") || digits.startsWith("979"))) return digits;
  if (digits.length === 10) return digits;
  return null;
};

type IsbnScannerProps = {
  onFound: (isbn: string) => void;
};

const IsbnScanner = ({ onFound }: IsbnScannerProps) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const stop = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setScanning(false);
  };

  // Releasing the camera on unmount is not optional: a page left with a live
  // track keeps the recording indicator on, which reads as the site spying.
  useEffect(() => () => stop(), []);

  useEffect(() => {
    if (!scanning) return;
    let stopped = false;
    let frame = 0;

    const run = async () => {
      try {
        const DetectorCtor = (window as unknown as {
          BarcodeDetector: new (opts: { formats: string[] }) => Detector;
        }).BarcodeDetector;
        const detector = new DetectorCtor({ formats: FORMATS });

        const stream = await navigator.mediaDevices.getUserMedia({
          // The rear camera, which is the one pointing at the book.
          video: { facingMode: "environment" },
        });
        streamRef.current = stream;
        const video = videoRef.current;
        if (!video) return;
        video.srcObject = stream;
        await video.play();

        const tick = async () => {
          if (stopped) return;
          try {
            const found = await detector.detect(video);
            for (const code of found) {
              const isbn = asIsbn(code.rawValue);
              if (isbn) {
                onFound(isbn);
                stop();
                return;
              }
            }
          } catch {
            // A single failed frame is normal while focusing; keep going.
          }
          frame = requestAnimationFrame(() => void tick());
        };
        void tick();
      } catch {
        // Almost always a refused camera permission. Saying so is more useful
        // than the browser's own exception text.
        setError("We could not open the camera. You can type the details instead.");
        setScanning(false);
      }
    };

    void run();
    return () => {
      stopped = true;
      cancelAnimationFrame(frame);
      stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scanning]);

  // Nothing to offer on a browser without a decoder — and a button that explains
  // it cannot work is worse than no button.
  if (!barcodeScanningAvailable()) return null;

  return (
    <div className="mt-3">
      {scanning ? (
        <div>
          <video
            ref={videoRef}
            playsInline
            muted
            className="w-full max-w-sm rounded-xl border border-bookvuk-border bg-black"
          />
          <p className="mt-2 text-xs text-bookvuk-muted">
            Point the camera at the barcode on the back cover.
          </p>
          <Button type="button" variant="secondary" size="sm" radius="lg" onClick={stop} className="mt-2">
            Stop
          </Button>
        </div>
      ) : (
        <>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            radius="lg"
            onClick={() => {
              setError(null);
              setScanning(true);
            }}
          >
            Scan the barcode
          </Button>
          {error ? <p className="mt-2 text-xs text-rose-700">{error}</p> : null}
        </>
      )}
    </div>
  );
};

export default IsbnScanner;
