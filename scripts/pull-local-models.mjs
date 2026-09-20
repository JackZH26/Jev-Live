// Downloads model weights only. It never reads application credentials.
const models=process.argv.slice(2);
if(!models.length)throw new Error('Provide one or more Ollama model names');
for(const model of models){
 if(!/^[a-zA-Z0-9_.:/-]+$/.test(model)||/cloud/i.test(model))throw new Error('Use a local model tag');
 const response=await fetch('http://127.0.0.1:11434/api/pull',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({model,stream:true})});
 if(!response.ok)throw new Error(`Model download returned ${response.status}`);
 let pending='',lastProgress=-1;
 for await(const chunk of response.body){pending+=new TextDecoder().decode(chunk);let end;
  while((end=pending.indexOf('\n'))>=0){const line=pending.slice(0,end);pending=pending.slice(end+1);if(!line)continue;const state=JSON.parse(line);if(state.error)throw new Error(state.error);
   const percent=state.total?Math.floor((state.completed??0)/state.total*100):undefined;
   if(percent!==undefined&&Math.floor(percent/10)>lastProgress){lastProgress=Math.floor(percent/10);console.log(`${model}: ${percent}%`);}
   if(state.status==='success')console.log(`${model}: ready`);
  }
 }
}
