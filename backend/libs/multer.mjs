import multer from "multer";

const createImageUploadMiddleware = (fieldName, maxFileSize) => {
  const imageUpload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: maxFileSize, files: 1 },
    fileFilter: (req, file, callback) => {
      if (!file.mimetype.startsWith("image/")) {
        callback(new Error("only images are allowed"));
        return;
      }
      callback(null, true);
    },
  });

  return (req, res, next) => {
    imageUpload.single(fieldName)(req, res, (error) => {
      if (!error) {
        next();
        return;
      }

      const isFileTooLarge =
        error instanceof multer.MulterError && error.code === "LIMIT_FILE_SIZE";
      const status =
        isFileTooLarge || error.message === "only images are allowed"
          ? 400
          : 500;
      res.status(status).send({
        message: isFileTooLarge
          ? "file upload limit is " + Math.floor(maxFileSize / 1_000_000) + "mb"
          : error.message,
      });
    });
  };
};

export const multerMiddleweare = createImageUploadMiddleware(
  "profilePicture",
  1_000_000,
);
export const postImageMiddleware = createImageUploadMiddleware(
  "image",
  5_000_000,
);
