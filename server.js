const express = require('express');
const { google } = require('googleapis');
const fs = require('fs');
const bodyParser = require('body-parser');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(bodyParser.json());

// Carregar credenciais
const auth = new google.auth.GoogleAuth({
  keyFile: 'credentials.json',
  scopes: ['https://www.googleapis.com/auth/documents', 'https://www.googleapis.com/auth/drive']
});
const docs = google.docs({ version: 'v1', auth });
const drive = google.drive({ version: 'v3', auth });

const TEMPLATE_ID = 'ID_DO_DOCUMENTO_MODELO'; // substitua pelo ID do seu modelo

// Função para gerar documento
async function generateDocument(data) {
  // Copiar o documento modelo
  const copy = await drive.files.copy({
    fileId: TEMPLATE_ID,
    requestBody: { name: `Documento_${Date.now()}` }
  });

  const docId = copy.data.id;

  // Substituir placeholders
  const requests = Object.keys(data).map(key => ({
    replaceAllText: {
      containsText: { text: `{{${key}}}`, matchCase: true },
      replaceText: data[key]
    }
  }));

  await docs.documents.batchUpdate({
    documentId: docId,
    requestBody: { requests }
  });

  // Exportar como PDF
  const pdf = await drive.files.export({
    fileId: docId,
    mimeType: 'application/pdf'
  }, { responseType: 'arraybuffer' });

  // Apagar arquivo temporário no Drive
  await drive.files.delete({ fileId: docId });

  return Buffer.from(pdf.data);
}

// Endpoint para gerar documento
app.post('/generate', async (req, res) => {
  try {
    const pdfBuffer = await generateDocument(req.body);
    res.setHeader('Content-Type', 'application/pdf');
    res.send(pdfBuffer);
  } catch (err) {
    console.error(err);
    res.status(500).send('Erro ao gerar documento');
  }
});

app.listen(3000, () => console.log('Servidor rodando na porta 3000'));
