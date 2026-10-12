// Conservative format validation only; never proof of a WhatsApp account or consent.
export const phoneCountries=[{code:'PK',label:'Pakistan (+92)',prefix:'92',lengths:[10]},{code:'AE',label:'United Arab Emirates (+971)',prefix:'971',lengths:[8,9]},{code:'IN',label:'India (+91)',prefix:'91',lengths:[10]},{code:'GB',label:'United Kingdom (+44)',prefix:'44',lengths:[10]},{code:'US',label:'US / Canada (+1)',prefix:'1',lengths:[10]},{code:'INTL',label:'Other — full international +number',prefix:'',lengths:[]}];
export function normalizePhone(raw:string,country:string){
 const rule=phoneCountries.find(c=>c.code===country);if(!rule)throw Error('Choose an explicit supported country or Other with a full +number.');
 if(!raw.trim()||raw.length>60||!/^\+?[\d\s().-]+$/.test(raw.trim()))throw Error('Enter one phone number, without extensions or multiple contacts.');
 let digits=raw.replace(/[^\d]/g,'');const international=raw.trim().startsWith('+');
 if(country==='INTL'){if(!international)throw Error('Other requires the full international number starting with + and country calling code.');}
 else if(international){if(!digits.startsWith(rule.prefix))throw Error('The calling code does not match the selected country.');digits=digits.slice(rule.prefix.length);}
 else if(country!=='US'&&digits.startsWith('0'))digits=digits.slice(1);
 if(country!=='INTL'){if(!rule.lengths.includes(digits.length)||digits.startsWith('0'))throw Error('Number length or national prefix is invalid for the selected country. Use local digits or a full +country number.');if(country==='US'&&!/^[2-9]\d{2}[2-9]\d{6}$/.test(digits))throw Error('US/Canada area and exchange codes must start with 2–9.');digits=rule.prefix+digits;}
 if(!/^[1-9]\d{6,14}$/.test(digits))throw Error('Use an international number with 7–15 digits, beginning with a valid nonzero calling code.');
 return '+'+digits;
}
export function suggestedPhoneCountry(value:string){if(/UAE|United Arab Emirates/i.test(value))return 'AE';if(/Pakistan/i.test(value))return 'PK';if(/India/i.test(value))return 'IN';if(/United Kingdom|\bUK\b/i.test(value))return 'GB';if(/United States|Canada|\bUSA\b/i.test(value))return 'US';return 'INTL';}
