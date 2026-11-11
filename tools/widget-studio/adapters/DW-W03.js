function(p,e,c){
 var R=p.records||[], v=p.verification||{}; if(!R.length) return H.need('No records.',['records']);
 if(v.residualIdentifiers!==0||v.restoresExactly!==true) return H.need('The de-identification check did not pass (residual identifiers: '+v.residualIdentifiers+'). The agent contract requires a clean result.',['verification']);
 return R.map(function(r){var d={};Object.keys(r).forEach(function(k){if(k!=='sourceRef'&&k!=='learnerCode')d[k]=r[k]});var o=H.base(c);o.status='ok';o.deidentifiedPayload=d;o.learnerToken=r.learnerCode;o.deidentified=true;return o});
}
