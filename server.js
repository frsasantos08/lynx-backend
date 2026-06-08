const express = require('express');
const fs      = require('fs');
const path    = require('path');
const cors    = require('cors');

const app  = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '2mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// Garante que a pasta existe
const REUNIAO_DIR = path.join(__dirname, 'public', 'reuniao');
if (!fs.existsSync(REUNIAO_DIR)) fs.mkdirSync(REUNIAO_DIR, { recursive: true });

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'Lynx Backend' });
});

// Endpoint principal chamado pelo nó 11 do n8n
app.post('/api/gerar-minisite', (req, res) => {
  try {
    const { slug, clienteJson } = req.body;

    if (!slug || !clienteJson) {
      return res.status(400).json({ success: false, error: 'slug e clienteJson são obrigatórios' });
    }

    const slugSeguro = slug.toLowerCase()
      .replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '').slice(0, 100);

    let clienteObj;
    try {
      clienteObj = typeof clienteJson === 'string' ? JSON.parse(clienteJson) : clienteJson;
    } catch(e) {
      return res.status(400).json({ success: false, error: 'clienteJson inválido' });
    }

    // Lê o template
    const templatePath = path.join(__dirname, 'templates', 'reuniao-template.html');
    if (!fs.existsSync(templatePath)) {
      return res.status(500).json({ success: false, error: 'Template não encontrado' });
    }

    let html = fs.readFileSync(templatePath, 'utf8');

    // Substitui o bloco CLIENTE no template
    const regex = /const CLIENTE\s*=\s*\{[\s\S]*?\};/m;
    html = html.replace(regex, 'const CLIENTE = ' + JSON.stringify(clienteObj, null, 2) + ';');

    // Guarda o ficheiro gerado
    const outputPath = path.join(REUNIAO_DIR, slugSeguro + '.html');
    fs.writeFileSync(outputPath, html, 'utf8');

    const dominio = process.env.DOMAIN || 'lynxagency.pt';
    const url = 'https://' + dominio + '/reuniao/' + slugSeguro + '.html';

    console.log('[OK] Mini-site gerado:', url);
    return res.json({ success: true, url, slug: slugSeguro });

  } catch (err) {
    console.error('[ERRO]', err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// Listar mini-sites gerados
app.get('/api/reunioes', (req, res) => {
  const ficheiros = fs.readdirSync(REUNIAO_DIR)
    .filter(f => f.endsWith('.html'))
    .map(f => ({ slug: f.replace('.html',''), url: '/reuniao/' + f }));
  res.json({ total: ficheiros.length, reunioes: ficheiros });
});

app.listen(PORT, () => console.log('Lynx Backend online na porta ' + PORT));