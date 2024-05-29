require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const router = express.Router();

const { initializeApp } = require("firebase/app");
const { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, } = require("firebase/auth");
const { getFirestore,Timestamp, deleteDoc, orderBy, updateDoc,increment, getDoc,getDocs,addDoc,setDoc, doc, writeBatch,collection, query, collectionGroup,where,runTransaction } = require('firebase/firestore');

// Your Firebase configuration
const firebaseConfig = {
  apiKey: process.env.FIREBASE_API_KEY,
  authDomain: process.env.FIREBASE_AUTH_DOMAIN,
  projectId: process.env.FIREBASE_PROJECT_ID,
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.FIREBASE_APP_ID
};

// Initialize Firebase App
const firebaseApp = initializeApp(firebaseConfig);

// Inisialisasi Firebase Authentication
const auth = getAuth(firebaseApp);
const firestore = getFirestore(firebaseApp);

// Fungsi untuk menghapus dokumen dari koleksi tertentu berdasarkan userName
const deleteDocuments = async (collectionName, userName) => {
  const collectionRef = collection(firestore, collectionName);
  const q = query(collectionRef, where("userName", "==", userName));
  const querySnapshot = await getDocs(q);

  const deletePromises = [];
  querySnapshot.forEach((document) => {
    deletePromises.push(deleteDoc(doc(firestore, collectionName, document.id)));
  });

  await Promise.all(deletePromises);
};

const addHistory = async (firestore, userName, jumlah) => {
  const historyData = {
    date: Timestamp.now(), // Using Firebase Timestamp
    jumlah: String(jumlah), // Convert jumlah to string
    kategori: "topUp",
    userName: userName
  };
  await addDoc(collection(firestore, 'History'), historyData);
};


router.delete('/delete/:userName', async (req, res) => {
  const userName = req.params.userName;

  try {
    // Hapus dari koleksi 'balance'
    await deleteDocuments('balance', userName);

    // Hapus dari koleksi 'users'
    await deleteDocuments('users', userName);

    // Hapus dari koleksi 'card'
    await deleteDocuments('card', userName);

    res.status(200).send(`Dokumen dengan userName ${userName} berhasil dihapus.`);
  } catch (error) {
    console.error("Terjadi kesalahan saat menghapus dokumen:", error);
    res.status(500).send("Terjadi kesalahan saat menghapus dokumen.");
  }
});

// Endpoint untuk registrasi
router.post('/register', async (req, res) => {
  const { email, password,nama, userName, noTlp, country } = req.body;

  try {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;
    // Lakukan sesuatu dengan user jika registrasi berhasil
    
    // Simpan data tambahan pengguna ke Firestore
    await addDoc(collection(firestore, 'users'), {
      nama,
      email,
      userName,
      noTlp,
      country
    });
    await addDoc(collection(firestore, 'card'), {
      userName,
      bank: "Fulus Bank",
      cardNumber: "200",
      status : "active",
      valid: new Date()
    });
    await addDoc(collection(firestore, 'balance'), {
      userName,
      balance: "0"
    });

    res.status(200).json({ message: "berhasil" });
  } catch (error) {
    res.status(400).send(error.message);
  }
});

// Endpoint untuk login
router.post('/login', async (req, res) => {
  const { userName, password } = req.body;

  try {
    // Lakukan verifikasi kredensial menggunakan signInWithEmailAndPassword
    const q = query(collection(firestore, 'users'), where('userName', '==', userName));
    const querySnapshot = await getDocs(q);
    const profiles = [];
    if (querySnapshot.empty) {
      return res.status(400).send({ message: "User tidak ditemukan" });
    } else {
      querySnapshot.forEach((doc) => {
        profiles.push(doc.data());
      });
    }
    const email = profiles[0].email;
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;
    // Lakukan sesuatu dengan user jika login berhasil
    return res.status(200).json({ message: "Login berhasil" });
  } catch (error) {
    return res.status(400).send({ message: "error" });
  }
});


router.get('/cekSaldo', async (req, res) => {
  const { userName } = req.query;

  try {
    const q = query(collection(firestore, 'balance'), where('userName', '==', userName));
    const querySnapshot = await getDocs(q);

    if (querySnapshot.empty) {
      res.status(400).send("User tidak ditemukan");
    } else {
      const balances = [];
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        if (data.balance !== undefined) {
          balances.push(data.balance);
        }
      });
      res.status(200).json({ message: balances[0]});
    }
  } catch (error) {
    res.status(400).send(error.message);
  }
});


router.get('/cekProfile', async (req, res) => {
  const { userName } = req.query;

  try {
    const q = query(collection(firestore, 'users'), where('userName', '==', userName));
    const querySnapshot = await getDocs(q);

    if (querySnapshot.empty) {
      res.status(400).send("User tidak ditemukan");
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
    const q = query(collection(firestore, 'History'), where('userName', '==', userName), orderBy('date', 'desc')); // Mengurutkan berdasarkan tanggal terbaru
    const querySnapshot = await getDocs(q);

    if (querySnapshot.empty) {
      res.status(400).send("User tidak ditemukan");
    } else {
      const profiles = [];
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        // Format the date field to a string
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

      // Sorting the profiles based on date (newest first)
      profiles.sort((a, b) => b.date - a.date);

      res.status(200).send(profiles);
    }
  } catch (error) {
    res.status(400).send(error.message);
  }
});

router.post('/topUp', async (req, res) => {
  const { userName, jumlah } = req.body;

  try {
    const q = query(collection(firestore, 'balance'), where('userName', '==', userName));
    const querySnapshot = await getDocs(q);

    if (querySnapshot.empty) {
      res.status(400).send("User tidak ditemukan");
    } else {
      // Asumsi hanya ada satu dokumen dengan userName tersebut
      const userDoc = querySnapshot.docs[0];
      const userRef = userDoc.ref;

      await runTransaction(firestore, async (transaction) => {
        const docSnapshot = await transaction.get(userRef);

        if (!docSnapshot.exists()) {
          throw "User tidak ditemukan";
        }

        const currentBalance = docSnapshot.data().balance || 0;
        const newBalance = currentBalance + jumlah; // Menambahkan jumlah langsung ke saldo
        transaction.update(userRef, { balance: newBalance });
      });

      // Call the addHistory function
      await addHistory(firestore, userName, jumlah);

      res.status(200).send("Top up berhasil");
    }
  } catch (error) {
    res.status(400).send(error.message);
  }
});



router.post('/transfer', async (req, res) => {
  const { userName, jumlah, tujuan } = req.body;

  try {
    // Query the sender's balance
    const senderQuery = query(collection(firestore, 'balance'), where('userName', '==', userName));
    const senderSnapshot = await getDocs(senderQuery);

    if (senderSnapshot.empty) {
      return res.status(400).send("User tidak ditemukan");
    }

    const senderDoc = senderSnapshot.docs[0];
    const senderData = senderDoc.data();

    if (senderData.balance === undefined || senderData.balance < jumlah) {
      return res.status(400).send("Saldo tidak cukup");
    }

    // Query the recipient's balance
    const recipientQuery = query(collection(firestore, 'balance'), where('userName', '==', tujuan));
    const recipientSnapshot = await getDocs(recipientQuery);

    if (recipientSnapshot.empty) {
      return res.status(400).send("Tujuan tidak ditemukan");
    }

    const recipientDoc = recipientSnapshot.docs[0];

    // Deduct the amount from the sender's balance
    await updateDoc(senderDoc.ref, {
      balance: increment(-jumlah)
    });

    // Add the amount to the recipient's balance
    await updateDoc(recipientDoc.ref, {
      balance: increment(jumlah)
    });

    res.status(200).send("Transfer berhasil");

  } catch (error) {
    res.status(400).send(error.message);
  }
});

module.exports = router;
