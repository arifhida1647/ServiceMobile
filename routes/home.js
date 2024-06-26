require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const { initializeApp } = require("firebase/app");
const { getAuth, signInWithEmailAndPassword, sendPasswordResetEmail } = require("firebase/auth");
const { getFirestore, collection, query, where, getDocs, orderBy, runTransaction, addDoc, Timestamp } = require("firebase/firestore");

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: process.env.FIREBASE_API_KEY,
  authDomain: process.env.FIREBASE_AUTH_DOMAIN,
  projectId: process.env.FIREBASE_PROJECT_ID,
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.FIREBASE_APP_ID,
  measurementId: process.env.FIREBASE_MEASUREMENT_ID
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth();
const db = getFirestore(); // Menggunakan getFirestore untuk mendapatkan objek Firestore
 
const admin = require('firebase-admin');
const router = express.Router();

const serviceAccount = require('../serviceAccount.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});
const firestore = admin.firestore();

const deleteDocuments = async (collectionName, userName) => {
  const collectionRef = firestore.collection(collectionName);
  const q = collectionRef.where("userName", "==", userName);
  const querySnapshot = await q.get();

  const deletePromises = [];
  querySnapshot.forEach((document) => {
    deletePromises.push(document.ref.delete());
  });

  await Promise.all(deletePromises);
};

// Function to delete user by UID
const deleteUserByUID = async (uid) => {
  try {
    // Delete Firestore document
    await firestore.collection('users').doc(uid).delete();
    console.log(`Firestore document for UID ${uid} deleted.`);

    // Delete user from Firebase Authentication
    await admin.auth().deleteUser(uid);
    console.log(`User with UID ${uid} deleted from Firebase Authentication.`);
  } catch (error) {
    console.error('Error deleting user:', error);
  }
};

// Fungsi login menggunakan email dan password
async function loginUserWithEmailAndPassword(email, password) {
  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;
    return "berhasil";
  } catch (error) {
    console.error('Login gagal:', error);
    throw error;
  }
}


const addHistory = async (db, userName, jumlah, kategori) => {
  const historyData = {
    date: Timestamp.now(),
    jumlah: String(jumlah),
    kategori: kategori,
    userName: userName
  };
  await addDoc(collection(db, 'History'), historyData);
};


router.post('/delete', async (req, res) => {
  const { userName, email } = req.body;

  try {
    const userRecord = await admin.auth().getUserByEmail(email);
    const uid = userRecord.uid;
    await deleteUserByUID(uid);
    await deleteDocuments('balance', userName);
    await deleteDocuments('users', userName);
    await deleteDocuments('card', userName);
    await deleteDocuments('History', userName);

    res.status(200).send({ message: "Delete successful" });
  } catch (error) {
    console.error("Error deleting documents:", error);
    res.status(500).send("Error deleting documents.");
  }
});

router.post('/register', async (req, res) => {
  const { email, password, nama, userName, noTlp, country } = req.body;

  if (!email || !password || !nama || !userName || !noTlp || !country) {
    return res.status(400).json({ message: 'All fields are required' });
  }

  try {
    // Use Firebase Admin SDK to create user
    const userRecord = await admin.auth().createUser({
      email,
      password,
      displayName: userName,
    });
    const uid = userRecord.uid;

    // Save user data to Firestore
    await addDoc(collection(db, 'users'), {
      nama,
      email,
      userName,
      noTlp,
      country,
      createdAt: Timestamp.now()
    });

    // Add default card for the user
    await addDoc(collection(db, 'card'), {
      userName,
      bank: "Fulus Bank",
      cardNumber: "200",
      status: "active",
      valid: new Date()
    });

    // Add initial balance for the user
    await addDoc(collection(db, 'balance'), {
      userName,
      balance: 0
    });

    res.status(200).json({ message: "Registration successful" });
  } catch (error) {
    console.error('Error registering user:', error);
    res.status(400).json({ message: error.message });
  }
});


// Endpoint login dan lainnya tetap sama
router.post('/login', async (req, res) => {
  const { userName, password } = req.body;

  try {
    // Mencari email berdasarkan userName
    const usersRef = collection(db, "users"); // Menggunakan db yang sudah diinisialisasi
    const q = query(usersRef, where("userName", "==", userName));
    const querySnapshot = await getDocs(q);
    if (!querySnapshot.empty) {
      const userDoc = querySnapshot.docs[0];
      const email = userDoc.data().email;
      
      // Melakukan login menggunakan fungsi loginUserWithEmailAndPassword
      const result = await loginUserWithEmailAndPassword(email, password);
      if (result === "berhasil") {
        res.json({ message: "Login Berhasil" });
      } else {
        res.status(400).json({ message: "Login Gagal" });
      }
    } else {
      res.status(400).json({ message: "User tidak ditemukan" });
    }
  } catch (error) {
    console.error('Login gagal:', error);
    res.status(400).json({ message: error.message });
  }
});

// Endpoint for forgot password
router.post('/forgot-password', async (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).send('Email is required');
  }

  try {
    await sendPasswordResetEmail(auth, email);
    res.status(200).json({ message: "Send Berhasil" });
  } catch (error) {
    console.error('Error sending password reset email:', error);
    res.status(500).send('Error sending password reset email');
  }
});

router.get('/cekSaldo', async (req, res) => {
  const { userName } = req.query;

  try {
    // Mencari saldo berdasarkan userName
    const balanceRef = collection(db, "balance");
    const q = query(balanceRef, where("userName", "==", userName));
    const querySnapshot = await getDocs(q);

    if (querySnapshot.empty) {
      res.status(400).send("User not found");
    } else {
      const balances = [];
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        if (data.balance !== undefined) {
          balances.push(data.balance);
        }
      });
      res.status(200).json({ message: balances[0] });
    }
  } catch (error) {
    console.error('Error fetching balance:', error);
    res.status(400).send(error.message);
  }
});


router.get('/cekProfile', async (req, res) => {
  const { userName } = req.query;

  try {
    const userRef = collection(db, "users");
    const q = query(userRef, where("userName", "==", userName));
    const querySnapshot = await getDocs(q);
    if (querySnapshot.empty) {
      res.status(400).send("User not found");
    } else {
      const profiles = [];
      querySnapshot.forEach((doc) => {
        profiles.push(doc.data());
      });
      res.status(200).send(profiles[0]);
    }
  } catch (error) {
    res.status(400).send(error.message);
  }
});

router.get('/cekHistory', async (req, res) => {
  const { userName } = req.query;

  try {
    // Mencari history berdasarkan userName dan mengurutkan berdasarkan tanggal
    const historyRef = collection(db, "History");
    const q = query(historyRef, where("userName", "==", userName), orderBy("date", "desc"));
    const querySnapshot = await getDocs(q);

    if (querySnapshot.empty) {
      res.status(400).send("User not found");
    } else {
      const profiles = [];
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        if (data.date) {
          const dateObj = data.date.toDate();
          data.date = dateObj.toLocaleString('id-ID', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
          });
        }
        profiles.push(data);
      });

      res.status(200).json(profiles);
    }
  } catch (error) {
    console.error('Error fetching history:', error);
    res.status(400).send(error.message);
  }
});

router.post('/topUp', async (req, res) => {
  const { userName, jumlah } = req.body;

  try {
    const balanceRef = collection(db, "balance");
    const q = query(balanceRef, where("userName", "==", userName));
    const querySnapshot = await getDocs(q);

    if (querySnapshot.empty) {
      res.status(400).send("User not found");
    } else {
      const userDoc = querySnapshot.docs[0];
      const userRef = userDoc.ref;

      await runTransaction(db, async (transaction) => {
        const docSnapshot = await transaction.get(userRef);

        if (!docSnapshot.exists) {
          throw new Error("User not found");
        }

        const currentBalance = docSnapshot.data().balance || 0;
        const newBalance = currentBalance + jumlah;
        transaction.update(userRef, { balance: newBalance });
      });

      await addHistory(db, userName, jumlah, "Cash In");

      res.status(200).send({ message: "TopUp successful" });
    }
  } catch (error) {
    console.error('Error processing top up:', error);
    res.status(400).send(error.message);
  }
});

router.post('/transfer', async (req, res) => {
  let { userName, jumlah, tujuan } = req.body;

  // Parse jumlah to number
  jumlah = parseFloat(jumlah);

  // Validate if jumlah is a valid number
  if (isNaN(jumlah) || jumlah <= 0) {
    return res.status(400).send({ message: "Invalid jumlah value" });
  }

  try {
    const senderQuery = query(collection(db, 'balance'), where('userName', '==', userName));
    const senderSnapshot = await getDocs(senderQuery);

    if (senderSnapshot.empty) {
      return res.status(400).send({ message: "User not found" });
    }

    const senderDoc = senderSnapshot.docs[0];
    const senderData = senderDoc.data();

    if (senderData.balance === undefined || senderData.balance < jumlah) {
      return res.status(400).send({ message: "Insufficient balance" });
    }

    const recipientQuery = query(collection(db, 'balance'), where('userName', '==', tujuan));
    const recipientSnapshot = await getDocs(recipientQuery);

    if (recipientSnapshot.empty) {
      return res.status(400).send({ message: "Recipient not found" });
    }

    const recipientDoc = recipientSnapshot.docs[0];
    const recipientRef = recipientDoc.ref;

    await runTransaction(db, async (transaction) => {
      const senderDocSnapshot = await transaction.get(senderDoc.ref);
      const recipientDocSnapshot = await transaction.get(recipientRef);

      if (!senderDocSnapshot.exists || !recipientDocSnapshot.exists) {
        throw new Error("User not found");
      }

      const newSenderBalance = senderDocSnapshot.data().balance - jumlah;
      const newRecipientBalance = recipientDocSnapshot.data().balance + jumlah;

      transaction.update(senderDoc.ref, { balance: newSenderBalance });
      transaction.update(recipientRef, { balance: newRecipientBalance });
    });

    await addHistory(db, userName, -jumlah, "Cash Out");
    await addHistory(db, tujuan, jumlah, "Cash In");

    res.status(200).send({ message: "Transfer successful" });
  } catch (error) {
    res.status(400).send(error.message);
  }
});


module.exports = router;
