import multer from "multer"
import { v4 as uuid } from "uuid"

const storage = multer.diskStorage({
  destination(req, file, callback) {
    //callback(error, filename)
    callback(null, "uploads")
  },
  filename(req, file, callback) {
    const id = uuid()
    //pop removes last element from an array so .png will be popped out
    const extName = file.originalname.split(".").pop()
    const fileName = `${id}.${extName}`

    //callback(null, file.originalname)
    callback(null, fileName)
  }
})

export const singleUpload = multer({ storage }).single("photo")