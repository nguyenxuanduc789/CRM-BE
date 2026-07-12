const app = require('./app');

// Trigger router creation without sending request
app.use((req, res, next) => next()); 

console.log('Router stack size:', app._router?.stack?.length);

app._router?.stack.forEach((layer, i) => {
  console.log(`[${i}] name: ${layer.name}, regexp: ${layer.regexp}`);
  if (layer.name === 'router') {
    layer.handle.stack.forEach((subLayer, j) => {
      console.log(`   └─ [${j}] name: ${subLayer.name}, regexp: ${subLayer.regexp}`);
      if (subLayer.name === 'router') {
         subLayer.handle.stack.forEach((subSubLayer, k) => {
           console.log(`         └─ [${k}] route: ${subSubLayer.route?.path}, methods: ${subSubLayer.route ? Object.keys(subSubLayer.route.methods) : ''}`);
         });
      }
    });
  }
});
