require("dotenv").config();

const express = require("express");
const fs = require("fs");
const cors = require("cors");
const fileUpload = require("express-fileupload");
const mongoose = require("mongoose");

const S3 = require("aws-sdk/clients/s3");





const {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
} = require("@aws-sdk/client-s3");

const bucketName = process.env.AWS_BUCKET_NAME;
const region = process.env.AWS_BUCKET_REGION;
const accessKeyId = process.env.AWS_ACCESS_KEY;
const secretAccessKey = process.env.AWS_SECRET_KEY;

const AWS_BUCKET_NAME = process.env.AWS_BUCKET_NAME
const AWS_BUCKET_REGION = process.env.AWS_BUCKET_REGION
const AWS_ACCESS_KEY = process.env.AWS_ACCESS_KEY
const AWS_SECRET_KEY = process.env.AWS_SECRET_KEY

const s3 = new S3({
  region,
  accessKeyId,
  secretAccessKey,
});

const client = new S3Client({
  region: AWS_BUCKET_REGION,
  credentials: {
    accessKeyId: AWS_ACCESS_KEY,
    secretAccessKey: AWS_SECRET_KEY,
  },
});

const port = process.env.PORT || 3000;

const app = express();
app.use(cors());
app.use(express.json());
app.use(fileUpload({
  useTempFiles : true,
  tempFileDir : './archivos'
}));

const Recibo = mongoose.model("Recibo", {
  cliente: String,
  total: Number,
  fechaDeEntrega: String,
  etiqueta: String,
  foto: Boolean,
});

async function uploadFile(file) {
  const stream = fs.createReadStream(file.tempFilePath);

  const uploadParams = {
    Bucket: AWS_BUCKET_NAME,
    Key: file.name,
    Body: stream,
  };

  console.log({ uploadParams });

  const command = new PutObjectCommand(uploadParams);

  return await client.send(command);
}

const generarCodigo = function () {
  let letras = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  let numeros = "0123456789";
  let cantidadDeNumeros = 10;
  let cantidadDeLetras = 26;

  let etiquetaLetras = "";
  let etiquetaNumeros = "";
  let etiqueta = "";

  for (let index = 0; index < 3; index++) {
    const indice = Math.floor(Math.random() * cantidadDeLetras);
    etiquetaLetras += letras[indice];
  }

  for (let index = 0; index < 3; index++) {
    const indice = Math.floor(Math.random() * cantidadDeNumeros);
    etiquetaNumeros += numeros[indice];
  }

  etiqueta = etiquetaLetras + etiquetaNumeros;

  return etiqueta;
};



app.post("/posts/upload", async (req, res) => {
  console.log({ 'req.files': req.files, name: req.files['image'].name })
  const result = await uploadFile(req.files["image"]);
  const reciboUpdate = await Recibo.findOneAndUpdate({ etiqueta: req.files['image'].name}, {foto: true})
  res.json({ result, reciboUpdate })
});

app.post("/posts/crear", async (req, res) => {
  let body = req.body;
  let etiqueta = generarCodigo();

  let etiquetaExiste = true;

  while (etiquetaExiste) {
    let recibo = await Recibo.findOne({ etiqueta });
    console.log({ recibo });
    if (recibo) {
      etiqueta = generarCodigo();
      etiquetaExiste = true;
    } else {
      etiquetaExiste = false;
    }
  }

  body["etiqueta"] = etiqueta;

  const recibo = new Recibo(body);
  const reciboDB = await recibo.save();

  return res.json({
    reciboDB,
  });
});

// app.post("/posts/upload", (req, res) => {
//   console.log({
//     req: req.files,
//   });
//   return res.json({ ok: true, req: req.files });
// });

app.get("/posts/:etiqueta", async (req, res) => {
  const downloadParams = {
    Key: req.params.etiqueta + ".jpg",
    Bucket: bucketName,
    Expires: 86400,
  };

  const url = s3.getSignedUrl("getObject", downloadParams);

  console.log({ url });

  let recibo = await Recibo.findOne({ etiqueta: req.params.etiqueta });

  let reciboString = JSON.stringify(recibo);

  recibo = JSON.parse(reciboString);

  recibo = { ...recibo, url };

  res.json(recibo);
});

app.post('/posts/crear-post-y-guardar-foto', async (req, res) => {
  try {
    let body = req.body;
    let etiqueta = generarCodigo();
  
    let etiquetaExiste = true;
  
    while (etiquetaExiste) {
      let recibo = await Recibo.findOne({ etiqueta });
      console.log({ recibo });
      if (recibo) {
        etiqueta = generarCodigo();
        etiquetaExiste = true;
      } else {
        etiquetaExiste = false;
      }
    }
  
    body["etiqueta"] = etiqueta;
  
    const recibo = new Recibo(body);
    const reciboDB = await recibo.save();

    const result = await uploadFile(req.files["image"]);
    const reciboUpdate = await Recibo.findOneAndUpdate({ etiqueta: req.files['image'].name}, {foto: true})

    res.json({
      ok: true,
      reciboDB,
      result,
      reciboUpdate
    })
  } catch (error) {
    res.status(500).json({ error })
  }
})

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
  mongoose.connect("mongodb://127.0.0.1:27017/recibos", () => {
    console.log("Conectado a base de datos");
  });
});
