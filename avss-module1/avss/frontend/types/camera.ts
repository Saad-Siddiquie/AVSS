export type CameraType = "rtsp" | "webcam" | "file";
export type CameraStatus = "active" | "inactive" | "error";

export interface Camera {
  id: number;
  name: string;
  url: string;
  camera_type: CameraType;
  location: string | null;
  status: CameraStatus;
  is_active: boolean;
  created_at: string | null;
  updated_at: string | null;
}

export interface CameraFormData {
  name: string;
  url: string;
  camera_type: CameraType;
  location: string;
  status: CameraStatus;
}
