import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import multer from 'multer';
import mammoth from 'mammoth';
import { Document, Packer, Paragraph, TextRun, AlignmentType, HeadingLevel } from 'docx';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const upload = multer({ storage: multer.memoryStorage() });

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  app.use(express.json());

  // API Routes
  app.post('/api/extract-text', upload.single('file'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
      }

      const result = await mammoth.extractRawText({ buffer: req.file.buffer });
      res.json({ text: result.value });
    } catch (error) {
      console.error('Extraction error:', error);
      res.status(500).json({ error: 'Failed to extract text' });
    }
  });

  app.post('/api/generate-annotated', async (req, res) => {
    try {
      const { text, findings } = req.body;
      
      // findings is an array of { text: string, category: 'Threat' | 'Error' | 'UAS', reason: string }
      
      const doc = new Document({
        sections: [{
          properties: {},
          children: [
            new Paragraph({
              text: "TEM Analysis Annotated Report",
              heading: HeadingLevel.HEADING_1,
              alignment: AlignmentType.CENTER,
            }),
            new Paragraph({
              text: "Document: Narrative 1.docx",
              alignment: AlignmentType.CENTER,
            }),
            new Paragraph({ text: "" }), // Spacer
            ...processTextWithHighlights(text, findings)
          ],
        }],
      });

      const buffer = await Packer.toBuffer(doc);
      
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
      res.setHeader('Content-Disposition', 'attachment; filename=Annotated_Report.docx');
      res.send(buffer);
    } catch (error) {
      console.error('Generation error:', error);
      res.status(500).json({ error: 'Failed to generate document' });
    }
  });

  function processTextWithHighlights(rawText: string, findings: any[]) {
    const paragraphs = rawText.split('\n').filter(p => p.trim() !== '');
    const result: Paragraph[] = [];

    for (const pText of paragraphs) {
      let currentText = pText;
      const runs: TextRun[] = [];

      // This is a simplified matching. In a real app, we'd use fuzzy matching or better tokenization.
      // We'll sort findings by length descending to avoid partial matches inside longer ones.
      const sortedFindings = [...findings].sort((a, b) => b.text.length - a.text.length);

      let lastIndex = 0;
      // For simplicity in this prototype, we'll just check if the paragraph contains any finding
      // and highlight the first occurrence. A more robust way would be to split the paragraph
      // into parts.
      
      // Let's try a better approach: find all occurrences of all findings in this paragraph
      let matches: { start: number, end: number, finding: any }[] = [];
      for (const finding of sortedFindings) {
        let index = pText.indexOf(finding.text);
        while (index !== -1) {
          // Check if this match overlaps with existing matches
          const overlaps = matches.some(m => (index >= m.start && index < m.end) || (index + finding.text.length > m.start && index + finding.text.length <= m.end));
          if (!overlaps) {
            matches.push({ start: index, end: index + finding.text.length, finding });
          }
          index = pText.indexOf(finding.text, index + 1);
        }
      }

      matches.sort((a, b) => a.start - b.start);

      let cursor = 0;
      for (const match of matches) {
        if (match.start > cursor) {
          runs.push(new TextRun(pText.substring(cursor, match.start)));
        }
        
        let highlightColor: "yellow" | "cyan" | "red" = 'yellow';
        if (match.finding.category === 'Threat') highlightColor = 'cyan';
        if (match.finding.category === 'UAS') highlightColor = 'red';
        if (match.finding.category === 'Error') highlightColor = 'yellow';

        runs.push(new TextRun({
          text: pText.substring(match.start, match.end),
          highlight: highlightColor,
        }));
        cursor = match.end;
      }

      if (cursor < pText.length) {
        runs.push(new TextRun(pText.substring(cursor)));
      }

      result.push(new Paragraph({ children: runs.length > 0 ? runs : [new TextRun(pText)] }));
    }

    return result;
  }

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
