import multer from "multer";
import { AppError } from "./error";

const MAX_CSV_BYTES = 2 * 1024 * 1024; // 2 MB

export const csvUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_CSV_BYTES, files: 1 },
  fileFilter: (_req, file, cb) => {
    const name = file.originalname.toLowerCase();
    if (!name.endsWith(".csv")) {
      cb(new AppError(400, "File must have a .csv extension"));
      return;
    }
    cb(null, true);
  },
});
