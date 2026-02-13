import { supabase } from "@/lib/supabase";

export interface UploadResult {
  url: string;
  error?: string;
}

export const uploadFile = async (
  file: File,
  bucket: string,
  folder: string,
  userId: string
): Promise<UploadResult> => {
  try {
    const fileExt = file.name.split(".").pop();
    const fileName = `${userId}/${folder}/${Date.now()}.${fileExt}`;
    const filePath = folder ? `${folder}/${fileName}` : fileName;

    const { data, error: uploadError } = await supabase.storage
      .from(bucket)
      .upload(filePath, file, {
        cacheControl: "3600",
        upsert: false,
      });

    if (uploadError) {
      return {
        url: "",
        error: uploadError.message,
      };
    }

    const { data: { publicUrl } } = supabase.storage
      .from(bucket)
      .getPublicUrl(filePath);

    return {
      url: publicUrl,
    };
  } catch (error: any) {
    return {
      url: "",
      error: error.message || "Failed to upload file",
    };
  }
};
