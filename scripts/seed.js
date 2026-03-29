const admin = require('firebase-admin');
const sa    = require('./serviceAccountKey.json');

admin.initializeApp({ credential: admin.credential.cert(sa) });
const auth = admin.auth();
const db   = admin.firestore();

const USERS = [
  {
    email: 'manager@mednova.com', password: 'mednova123', displayName: 'Vikram Nair',
    profile: { name: 'Vikram Nair', email: 'manager@mednova.com', role: 'manager', territory: 'All Zones', experience: '10 years', performanceScore: 95 },
  },
  {
    email: 'sp1@mednova.com', password: 'mednova123', displayName: 'Arjun Mehta',
    profile: { name: 'Arjun Mehta', email: 'sp1@mednova.com', role: 'sp', territory: 'North Zone', experience: '3 years', performanceScore: 82, closureRate: '74%', strengths: ['Cardiology', 'GP rapport'], avgDealSize: 12400 },
  },
  {
    email: 'sp2@mednova.com', password: 'mednova123', displayName: 'Priya Sharma',
    profile: { name: 'Priya Sharma', email: 'sp2@mednova.com', role: 'sp', territory: 'South Zone', experience: '5 years', performanceScore: 91, closureRate: '88%', strengths: ['Diabetology', 'Neurology', 'objection handling'], avgDealSize: 18700 },
  },
];

async function seed() {
  console.log('\n🌱 PharmaFlow Seed\n' + '='.repeat(36));
  for (const u of USERS) {
    let uid;
    try {
      const rec = await auth.createUser({ email: u.email, password: u.password, displayName: u.displayName });
      uid = rec.uid;
      console.log(`✅ Created: ${u.email}`);
    } catch (e) {
      if (e.code === 'auth/email-already-exists') {
        const rec = await auth.getUserByEmail(u.email);
        uid = rec.uid;
        console.log(`⚡ Exists:  ${u.email}`);
      } else throw e;
    }
    await db.collection('users').doc(uid).set({ ...u.profile, uid, updatedAt: admin.firestore.FieldValue.serverTimestamp() });
    console.log(`   └─ Firestore profile saved (uid: ${uid})`);
  }
  console.log('\n✅ Done!\nCredentials:\n  manager@mednova.com / mednova123\n  sp1@mednova.com / mednova123\n  sp2@mednova.com / mednova123\n');
  process.exit(0);
}

seed().catch(e => { console.error(e); process.exit(1); });