/** Crockford base32: no I, L, O or U, so a token survives being read aloud or retyped. */
const TOKEN_ALPHABET='0123456789ABCDEFGHJKMNPQRSTVWXYZ';
/** 16 characters of 5 bits each: 80 random bits, shown as SPN-XXXX-XXXX-XXXX-XXXX. Guessing online is hopeless: the site only accepts issued tokens and limits requests. */
const TOKEN_GROUPS=4,TOKEN_GROUP=4;

/** The token's characters without prefix, dashes or spaces, upper case; null when it cannot be a token. */
export function normalizeToken(value:string):string|null{
 const body=value.toUpperCase().replace(/[\s-]/g,'').replace(/^SPN/,'');
 return body.length===TOKEN_GROUPS*TOKEN_GROUP&&[...body].every(c=>TOKEN_ALPHABET.includes(c))?body:null;
}

export function newToken(){
 // 256 is a multiple of 32, so taking each byte modulo 32 keeps every character equally likely.
 const chars=Array.from(crypto.getRandomValues(new Uint8Array(TOKEN_GROUPS*TOKEN_GROUP)),b=>TOKEN_ALPHABET[b%32]);
 return ['SPN',...Array.from({length:TOKEN_GROUPS},(_,i)=>chars.slice(i*TOKEN_GROUP,(i+1)*TOKEN_GROUP).join(''))].join('-');
}

/** SHA-256 of the normalised token, so one pasted with spaces or in lower case still matches; null when it cannot be a token. */
export async function tokenHash(token:string):Promise<string|null>{
 const body=normalizeToken(token);
 if(!body)return null;
 const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(body));
 return Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,'0')).join('');
}
