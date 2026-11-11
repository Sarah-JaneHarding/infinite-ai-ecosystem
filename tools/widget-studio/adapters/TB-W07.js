function(p,e,c){
 var L=p.lines||[]; if(!L.length) return {status:'no_source_content',detail:'There are no lines to adapt.'};
 var M={'large print':'LARGE_PRINT','dyslexia friendly':'DYSLEXIA_FRIENDLY','dyslexia-friendly':'DYSLEXIA_FRIENDLY','simplified language':'SIMPLIFIED_LANGUAGE','braille ready':'BRAILLE_READY','braille-ready':'BRAILLE_READY'}, mode=M[String(p.mode).toLowerCase()];
 if(!mode) return H.need('The mode "'+p.mode+'" is not one the agent contract lists.',['mode']);
 var ck=p.checklist||[]; if(!ck.length) return H.need('No accessibility checks were recorded.',['checklist']);
 var checks=ck.map(function(k){return {name:'Check '+k.n,required:k.text,measured:k.result,pass:k.result==='pass'}}), pass=checks.every(function(x){return x.pass}), res={mode:mode,checks:checks,verdict:pass?'pass':'fail'};
 if(!pass) return {status:'accessibility_check_failed',accessibilityMode:mode,accessibilityCheckResult:res,detail:'One or more accessibility checks did not pass.'};
 var o=H.artefact(p,c,e,'ACCESSIBLE_ARTEFACT'); o.adaptedContent=L.map(function(l){return l.text}).join('\n'); o.accessibilityMode=mode; o.accessibilityCheckResult=res; return o;
}
