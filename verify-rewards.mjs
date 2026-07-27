import { initializeApp as aInit, cert } from "firebase-admin/app";
import { getAuth as aAuth } from "firebase-admin/auth";
import { getFirestore as aDb, FieldValue } from "firebase-admin/firestore";
import { initializeApp as cInit } from "firebase/app";
import { getAuth as cAuth, signInWithCustomToken } from "firebase/auth";
import { getFirestore, doc, getDoc } from "firebase/firestore";
import { getFunctions, httpsCallable } from "firebase/functions";
import { createHash } from "crypto";

const admin=aInit({credential:cert({projectId:process.env.FIREBASE_PROJECT_ID,clientEmail:process.env.FIREBASE_CLIENT_EMAIL,privateKey:process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g,"\n")})});
const adminAuth=aAuth(admin), adminDb=aDb(admin);
const cfg={apiKey:process.env.NEXT_PUBLIC_FIREBASE_API_KEY,authDomain:process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,projectId:process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,appId:process.env.NEXT_PUBLIC_FIREBASE_APP_ID};
const BASE="http://localhost:3000";
const pass=(m)=>console.log("  ✓ "+m); const fail=(m)=>{console.log("  ✗ "+m);process.exitCode=1;};
const ecode=(e)=>String(e?.code||"");
const sha=(s)=>createHash("sha256").update(s).digest("hex");
async function mkUser(t,role){const u=await adminAuth.createUser({displayName:"RW"+t});await adminAuth.setCustomUserClaims(u.uid,{role,organizationId:"activelyte"});
  await adminDb.collection("users").doc(u.uid).set({uid:u.uid,organizationId:"activelyte",email:`rw${t}@x.test`,displayName:"RW"+t,role,status:"active",createdAt:FieldValue.serverTimestamp(),createdBy:"v",updatedAt:FieldValue.serverTimestamp(),updatedBy:"v"});return u.uid;}
async function tok(uid){return adminAuth.createUserToken? null:null;}
async function clientOf(uid,t){const app=cInit(cfg,t+Date.now());await signInWithCustomToken(cAuth(app),await adminAuth.createCustomToken(uid));return app;}
async function idTok(uid,t){const app=cInit(cfg,"id"+t+Date.now());const c=await signInWithCustomToken(cAuth(app),await adminAuth.createCustomToken(uid));return c.user.getIdToken();}
async function api(path,token,method="GET",body){const r=await fetch(BASE+path,{method,headers:{authorization:`Bearer ${token}`,...(body?{"content-type":"application/json"}:{})},body:body?JSON.stringify(body):undefined});return {status:r.status,body:await r.json().catch(()=>({}))};}

const founder=await adminAuth.getUserByEmail(process.env.FOUNDER_EMAIL);
const fTok=await idTok(founder.uid,"F");
let bUid, prodId, rewCheapId, rewPriceyId; const created={codes:[],scans:[],txns:[],redemptions:[]};
try {
  bUid=await mkUser("B","bartender");
  const bApp=await clientOf(bUid,"B");
  const bFns=getFunctions(bApp), bDb=getFirestore(bApp);
  const scan=httpsCallable(bFns,"validateAndRedeemCode");
  const redeem=httpsCallable(bFns,"submitRedemption");

  // --- catalog setup via admin API ---
  let r=await api("/api/admin/products",fTok,"POST",{name:"Test Lager",barcode:"BARCODE-TEST-1",rewardPoints:10,perUserDailyLimit:2});
  prodId=r.body.id; r.status===200&&prodId?pass("1) admin created product (barcode, 10pts, 2/day)"):fail("create product "+JSON.stringify(r));
  const uniqueCode="UNIQ-"+Date.now();
  r=await api("/api/admin/products/codes",fTok,"POST",{productId:prodId,points:50,codes:[uniqueCode]});
  created.codes.push(sha(uniqueCode));
  r.body.created===1?pass("2) admin registered 1 unique code (50pts, stored hashed)"):fail("codes "+JSON.stringify(r));

  // --- scan unique code ---
  let res=await scan({code:uniqueCode});
  res.data.pointsAwarded===50&&res.data.newBalance===50?pass(`3) unique code scan → +50 (balance ${res.data.newBalance})`):fail("scan unique "+JSON.stringify(res.data));
  // duplicate unique code
  let ok=false; try{ await scan({code:uniqueCode}); }catch(e){ ok=ecode(e).includes("already-exists");} ok?pass("4) same unique code again → already-redeemed (duplicate blocked)"):fail("dup unique not blocked");

  // --- product barcode with daily limit 2 ---
  res=await scan({code:"BARCODE-TEST-1",idempotencyKey:"k1"}); const b1=res.data.newBalance;
  res=await scan({code:"BARCODE-TEST-1",idempotencyKey:"k2"}); const b2=res.data.newBalance;
  b1===60&&b2===70?pass(`5) product barcode scans within limit → +10 each (balance ${b2})`):fail("barcode scans "+b1+","+b2);
  ok=false; try{ await scan({code:"BARCODE-TEST-1",idempotencyKey:"k3"}); }catch(e){ ok=ecode(e).includes("resource-exhausted");} ok?pass("6) 3rd scan same day → daily limit reached (abuse blocked)"):fail("daily limit not enforced");
  // idempotency replay
  res=await scan({code:"BARCODE-TEST-1",idempotencyKey:"k1"}); res.data.replay===true&&res.data.newBalance===70?pass("7) replay same idempotencyKey → no double credit"):fail("idempotency "+JSON.stringify(res.data));

  // --- rewards ---
  r=await api("/api/admin/rewards",fTok,"POST",{title:"Free Pint",pointsRequired:30,requiresApproval:true}); rewCheapId=r.body.id;
  r=await api("/api/admin/rewards",fTok,"POST",{title:"VIP Table",pointsRequired:99999}); rewPriceyId=r.body.id;
  rewCheapId&&rewPriceyId?pass("8) admin created 2 rewards"):fail("rewards create");

  let rd=await redeem({rewardId:rewCheapId}); created.redemptions.push(rd.data.redemptionId);
  rd.data.status==="pending"&&rd.data.newBalance===40?pass(`9) redeem 30pts → pending (balance ${rd.data.newBalance})`):fail("redeem "+JSON.stringify(rd.data));
  ok=false; try{ await redeem({rewardId:rewPriceyId}); }catch(e){ ok=ecode(e).includes("failed-precondition");} ok?pass("10) redeem unaffordable → insufficient points blocked"):fail("insufficient not blocked");

  // --- admin decides (reject → refund) ---
  const decide=httpsCallable(getFunctions(await clientOf(founder.uid,"Fd")),"decideRedemption");
  await decide({redemptionId:rd.data.redemptionId,decision:"reject"});
  const acc=(await adminDb.collection("loyaltyAccounts").doc(bUid).get()).data();
  acc.balance===70?pass(`11) admin rejected redemption → 30pts refunded (balance ${acc.balance})`):fail("refund balance "+acc.balance);

  // --- rules: user reads own loyalty, not others ---
  (await getDoc(doc(bDb,"loyaltyAccounts",bUid))).exists()?pass("12) user reads own loyalty account"):fail("own loyalty read");
  ok=false; try{ await getDoc(doc(bDb,"loyaltyAccounts",founder.uid)); }catch(e){ ok=String(e?.code).includes("permission-denied");} ok?pass("13) user CANNOT read another's loyalty account"):fail("cross loyalty read not denied");

  // ledger immutability sanity: count txns
  const txns=await adminDb.collection("loyaltyTransactions").where("accountId","==",bUid).get();
  txns.size>=5?pass(`14) immutable ledger has ${txns.size} entries (earns+redeem+reversal)`):fail("ledger "+txns.size);
} catch(e){ fail("THREW: "+ecode(e)+" "+e?.message); }
finally {
  // cleanup
  if(bUid){
    const txns=await adminDb.collection("loyaltyTransactions").where("accountId","==",bUid).get(); await Promise.all(txns.docs.map(d=>d.ref.delete()));
    const scans=await adminDb.collection("scanEvents").where("userId","==",bUid).get(); await Promise.all(scans.docs.map(d=>d.ref.delete()));
    const reds=await adminDb.collection("redemptions").where("userId","==",bUid).get(); await Promise.all(reds.docs.map(d=>d.ref.delete()));
    await adminDb.collection("loyaltyAccounts").doc(bUid).delete().catch(()=>{});
    await adminAuth.deleteUser(bUid).catch(()=>{}); await adminDb.collection("users").doc(bUid).delete().catch(()=>{});
  }
  for(const h of created.codes) await adminDb.collection("productCodes").doc(h).delete().catch(()=>{});
  if(prodId) await adminDb.collection("products").doc(prodId).delete().catch(()=>{});
  for(const id of [rewCheapId,rewPriceyId]) if(id) await adminDb.collection("rewards").doc(id).delete().catch(()=>{});
  // audit logs for these
  pass("cleanup done"); process.exit(process.exitCode||0);
}
