import { Camera } from "@capacitor/camera";
import { Capacitor } from "@capacitor/core";
import { isNativeAppRuntime } from "./nativeRuntime";

export async function requestNativePhotoPermission() {
  if (!isNativeAppRuntime()) {
    return true;
  }

  // Android's system photo picker grants access only to the image selected by
  // the user and does not require broad media-library permission.
  if (Capacitor.getPlatform() === "android") {
    return true;
  }

  try {
    const current = await Camera.checkPermissions();

    if (current.photos === "granted" || current.photos === "limited") {
      return true;
    }

    const requested = await Camera.requestPermissions({
      permissions: ["photos"],
    });

    return requested.photos === "granted" || requested.photos === "limited";
  } catch {
    return false;
  }
}

export async function requestNativeCameraPermission() {
  if (!isNativeAppRuntime()) {
    return true;
  }

  try {
    const current = await Camera.checkPermissions();

    if (current.camera === "granted") {
      return true;
    }

    const requested = await Camera.requestPermissions({
      permissions: ["camera"],
    });

    return requested.camera === "granted";
  } catch {
    return false;
  }
}
