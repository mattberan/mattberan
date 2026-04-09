require('dotenv').config({ path: '../.env' });
const express = require('express');
const path = require('path');

const app = express();
const PORT = 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'ui')));

app.use('/api/issues', require('./routes/issues'));
app.use('/api/preview', require('./routes/preview'));
app.use('/api/publish', require('./routes/publish'));
app.use('/api/social', require('./routes/social'));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'ui', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Beran Brief builder running at http://localhost:${PORT}`);
});
