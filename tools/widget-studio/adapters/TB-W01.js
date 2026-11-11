function(p,e,c){
 var I=p.items||[]; if(!I.length) return H.need('No items.',['items']); var src=H.cited(p); if(!src.length) return H.noSrc();
 var tier=c.extra.differentiationTier; if(['SUPPORT','STANDARD','EXTENSION'].indexOf(tier)<0) return H.need('The agent contract asks for a differentiation tier (SUPPORT, STANDARD or EXTENSION). The widget has levels, not a tier. Type one.',['differentiationTier']);
 var r=H.readab(c); if(r.need) return H.needRead(r); if(r.out) return H.need('Measured reading grade '+r.m+' is outside the target band '+r.lo+' to '+r.hi+'. Change the text, or correct the numbers.',['measuredGrade']);
 var by={}; I.forEach(function(i){(by[i.level]=by[i.level]||[]).push(i)});
 var o=H.artefact(p,c,e,'WORKSHEET'); o.sections=Object.keys(by).sort().map(function(l){var a=by[l],ins=H.uniq(a.map(function(i){return i.instruction}).filter(Boolean)).join(' ');var s={title:'Level '+l,questions:a.map(function(i){return i.question})};if(ins)s.instructions=ins;return s});
 o.readabilityCheckResult=r.ok; o.citedSourceIds=src; o.differentiationTier=tier; return o;
}
