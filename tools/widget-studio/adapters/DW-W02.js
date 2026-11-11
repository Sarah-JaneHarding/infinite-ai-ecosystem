function(p,e,c){
 var P=(p.active&&p.active.purposes)||[], F=p.fieldStatus||[]; if(!P.length) return H.need('No active purposes are recorded.',['active.purposes']);
 if((p.blockedFields||[]).length) return {status:'blocked',blockedFields:p.blockedFields.slice(),detail:'These fields have no purpose or consent that covers them: '+p.blockedFields.join(', ')+'.'};
 var o=H.base(c); o.status='ok'; o.consentBasis=H.uniq(P.map(function(x){return x.basisLabel||x.basis})).join('; '); o.permittedFields=F.filter(function(f){return f.usable}).map(function(f){return f.field}); return o;
}
