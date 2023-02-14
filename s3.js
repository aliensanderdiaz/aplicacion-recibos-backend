async function uploadFile(file) {

    const stream = fs.createReadStream(file.tempFilePath)

    const uploadParams = {
        Bucket: AWS_BUCKET_NAME,
        Key: file.name,
        Body: stream
    }

    console.log({ uploadParams })

    const command = new PutObjectCommand(uploadParams)
    
    return await client.send(command);
}