import { useCallback, useEffect, useState } from "react";
import Cropper, { type Area } from "react-easy-crop";
import { useTranslation } from "react-i18next";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { Loader2, RotateCw } from "lucide-react";

interface PhotoCropDialogProps {
  open: boolean;
  file: File | null;
  isUploading?: boolean;
  onCancel: () => void;
  onConfirm: (file: File) => void;
}

const OUTPUT_SIZE = 512;

async function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = (e) => reject(e);
    img.src = src;
  });
}

async function cropImage(
  src: string,
  area: Area,
  rotation: number,
  mimeType: string,
): Promise<Blob> {
  const image = await loadImage(src);
  const radians = (rotation * Math.PI) / 180;

  const sin = Math.abs(Math.sin(radians));
  const cos = Math.abs(Math.cos(radians));
  const rotW = image.width * cos + image.height * sin;
  const rotH = image.width * sin + image.height * cos;

  const rotCanvas = document.createElement("canvas");
  rotCanvas.width = rotW;
  rotCanvas.height = rotH;
  const rotCtx = rotCanvas.getContext("2d");
  if (!rotCtx) throw new Error("canvas unavailable");
  rotCtx.translate(rotW / 2, rotH / 2);
  rotCtx.rotate(radians);
  rotCtx.drawImage(image, -image.width / 2, -image.height / 2);

  const out = document.createElement("canvas");
  out.width = OUTPUT_SIZE;
  out.height = OUTPUT_SIZE;
  const outCtx = out.getContext("2d");
  if (!outCtx) throw new Error("canvas unavailable");
  outCtx.drawImage(
    rotCanvas,
    area.x,
    area.y,
    area.width,
    area.height,
    0,
    0,
    OUTPUT_SIZE,
    OUTPUT_SIZE,
  );

  const type = mimeType === "image/png" ? "image/png" : "image/jpeg";
  const quality = type === "image/jpeg" ? 0.92 : undefined;
  return new Promise((resolve, reject) => {
    out.toBlob(
      (blob) => {
        if (!blob) reject(new Error("blob failed"));
        else resolve(blob);
      },
      type,
      quality,
    );
  });
}

export function PhotoCropDialog({
  open,
  file,
  isUploading,
  onCancel,
  onConfirm,
}: PhotoCropDialogProps) {
  const { t } = useTranslation();
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!file) {
      setImageSrc(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setImageSrc(url);
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setRotation(0);
    setCroppedAreaPixels(null);
    setError(null);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const onCropComplete = useCallback((_area: Area, areaPixels: Area) => {
    setCroppedAreaPixels(areaPixels);
  }, []);

  const handleConfirm = async () => {
    if (!file || !imageSrc || !croppedAreaPixels) return;
    setIsProcessing(true);
    setError(null);
    try {
      const mime =
        file.type === "image/png" || file.type === "image/webp"
          ? "image/png"
          : "image/jpeg";
      const blob = await cropImage(imageSrc, croppedAreaPixels, rotation, mime);
      const ext = mime === "image/png" ? "png" : "jpg";
      const baseName = file.name.replace(/\.[^.]+$/, "") || "photo";
      const cropped = new File([blob], `${baseName}-cropped.${ext}`, {
        type: mime,
      });
      onConfirm(cropped);
    } catch {
      setError(t("employees.cropFailed"));
    } finally {
      setIsProcessing(false);
    }
  };

  const busy = isProcessing || isUploading;

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o && !busy) onCancel();
      }}
    >
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t("employees.cropPhotoTitle")}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="relative w-full h-72 bg-muted rounded-md overflow-hidden">
            {imageSrc && (
              <Cropper
                image={imageSrc}
                crop={crop}
                zoom={zoom}
                rotation={rotation}
                aspect={1}
                cropShape="rect"
                showGrid={false}
                onCropChange={setCrop}
                onZoomChange={setZoom}
                onRotationChange={setRotation}
                onCropComplete={onCropComplete}
              />
            )}
          </div>
          <div className="space-y-2">
            <Label className="text-xs">{t("employees.cropZoom")}</Label>
            <Slider
              value={[zoom]}
              min={1}
              max={4}
              step={0.05}
              onValueChange={(v) => setZoom(v[0] ?? 1)}
              data-testid="slider-crop-zoom"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-xs">{t("employees.cropRotation")}</Label>
            <div className="flex items-center gap-2">
              <Slider
                value={[rotation]}
                min={0}
                max={360}
                step={1}
                onValueChange={(v) => setRotation(v[0] ?? 0)}
                data-testid="slider-crop-rotation"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setRotation((r) => (r + 90) % 360)}
                data-testid="button-crop-rotate-90"
              >
                <RotateCw className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
          {error && (
            <p className="text-xs text-destructive" data-testid="text-crop-error">
              {error}
            </p>
          )}
        </div>
        <DialogFooter>
          <Button
            type="button"
            variant="ghost"
            onClick={onCancel}
            disabled={busy}
            data-testid="button-crop-cancel"
          >
            {t("common.cancel")}
          </Button>
          <Button
            type="button"
            onClick={handleConfirm}
            disabled={busy || !croppedAreaPixels}
            data-testid="button-crop-confirm"
          >
            {busy && <Loader2 className="h-3.5 w-3.5 me-1 animate-spin" />}
            {t("employees.cropConfirm")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
