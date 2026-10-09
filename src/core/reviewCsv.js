export function reviewCsv(value,{required=[],maximumRows=100} = {}) {
  if(typeof value!=='string' || value.length>200000)throw new Error('Use a CSV smaller than 200 KB.');
  const records=[],row=[];let cell='',quoted=false;
  for(let i=0;i<=value.length;i++) {
    const char=value[i];
    if(char==='"'){if(quoted && value[i+1]==='"'){cell+='"';i++;}else quoted=!quoted;}
    else if(!quoted && (char===',' || char==='\n' || char===undefined)){row.push(cell.trim());cell='';if(char!==','){if(row.some(Boolean))records.push([...row]);row.length=0;}}
    else if(char!=='\r')cell+=char;
  }
  if(quoted)throw new Error('A quoted CSV field is unfinished.');
  const headers=(records.shift() || []).map(value=>value.toLowerCase());
  if(new Set(headers).size!==headers.length || required.some(key=>!headers.includes(key)))throw new Error(`CSV headers must include ${required.join(',')}, without duplicate columns.`);
  if(!records.length || records.length>maximumRows)throw new Error(`Review between 1 and ${maximumRows} rows at a time.`);
  return records.map(cells=>{if(cells.length!==headers.length)throw new Error('CSV rows must have the same columns as the header.');return Object.fromEntries(headers.map((key,index)=>[key,cells[index]]));});
}
