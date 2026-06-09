const fs = require('fs');
const glob = require('glob'); // Need a way to glob or just use simple readdir

function fixDir(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    if (file.endsWith('.tsx')) {
      let content = fs.readFileSync(dir + '/' + file, 'utf8');
      
      // Fix placeholder=t.some.thing to placeholder={t.some.thing}
      content = content.replace(/placeholder=t\.([a-zA-Z0-Name.]+)/g, 'placeholder={t.$1}');
      
      // Fix title=t.some.thing to title={t.some.thing}
      content = content.replace(/title=t\.([a-zA-Z0-Name.]+)/g, 'title={t.$1}');
      
      // Fix value=t.some.thing to value={t.some.thing}
      content = content.replace(/value=t\.([a-zA-Z0-Name.]+)/g, 'value={t.$1}');

      // Fix label=t.some.thing to label={t.some.thing}
      content = content.replace(/label=t\.([a-zA-Z0-Name.]+)/g, 'label={t.$1}');

      // Fix text=t.some.thing to text={t.some.thing}
      content = content.replace(/text=t\.([a-zA-Z0-Name.]+)/g, 'text={t.$1}');
      
      // Look for any other `prop=t.` which is invalid JSX
      content = content.replace(/([a-zA-Z0-9_-]+)=t\.([a-zA-Z0-Name.]+)/g, '$1={t.$2}');

      fs.writeFileSync(dir + '/' + file, content);
    }
  }
}

fixDir('client/src/pages');
fixDir('client/src/components');
console.log("Fixed globally!");
