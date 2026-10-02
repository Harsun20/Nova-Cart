const app = require('./app');

const port = Number(process.env.PORT) || 8787;
app.listen(port, () => console.log(`Trust Engine API listening on http://localhost:${port}/api`));
