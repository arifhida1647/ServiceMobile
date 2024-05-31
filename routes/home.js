require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const admin = require('firebase-admin');
const router = express.Router();
const { loginUserWithEmailAndPassword } = require('./login');


const serviceAccount = require('../serviceAccount.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const firestore = admin.firestore();
const auth = admin.auth();

// Fungsi untuk menghapus dokumen dari koleksi tertentu berdasarkan userName
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

// Fungsi untuk menghapus pengguna berdasarkan UID
const deleteUserByUID = async (uid) => {
  try {
    // Hapus dokumen Firestore
    await firestore.collection('users').doc(uid).delete();
    console.log(`Firestore document for UID ${uid} deleted.`);

    // Hapus pengguna dari Firebase Authentication
    await auth.deleteUser(uid);
    console.log(`User with UID ${uid} deleted from Firebase Authentication.`);
  } catch (error) {
    console.error('Error deleting user:', error);
  }
};

const addHistory = async (firestore, userName, jumlah, kategori) => {
  const historyData = {
    date: admin.firestore.Timestamp.now(),
    jumlah: String(jumlah),
    kategori: kategori,
    userName: userName
  };
  await firestore.collection('History').add(historyData);
};

router.post('/delete', async (req, res) => {
  const { userName, email } = req.body;

  try {
    const userRecord = await auth.getUserByEmail(email);
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

// Endpoint lain tetap sama seperti sebelumnya, hanya perlu diperbarui untuk menggunakan Firebase Admin SDK
router.post('/register', async (req, res) => {
  const { email, password, nama, userName, noTlp, country } = req.body;

  try {
    const userRecord = await auth.createUser({
      email: email,
      password: password,
    });
    const uid = userRecord.uid;

    await firestore.collection('users').doc(uid).set({
      nama,
      email,
      userName,
      noTlp,
      country
    });
    await firestore.collection('card').add({
      userName,
      bank: "Fulus Bank",
      cardNumber: "200",
      status: "active",
      valid: new Date()
    });
    await firestore.collection('balance').add({
      userName,
      balance: 0
    });

    res.status(200).json({ message: "Registration successful" });
  } catch (error) {
    res.status(400).send(error.message);
  }
});

// Endpoint login dan lainnya tetap sama
router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  try {
    const result = await loginUserWithEmailAndPassword(email, password);
    if (result === "berhasil") {
      res.json({ message: "Login Berhasil" });
    } else {
      res.status(400).json({ message: "Login Gagal" });
    }
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});


router.get('/cekSaldo', async (req, res) => {
  const { userName } = req.query;

  try {
    const q = firestore.collection('balance').where('userName', '==', userName);
    const querySnapshot = await q.get();

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
    res.status(400).send(error.message);
  }
});

router.get('/cekProfile', async (req, res) => {
  const { userName } = req.query;

  try {
    const q = firestore.collection('users').where('userName', '==', userName);
    const querySnapshot = await q.get();

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
    const q = firestore.collection('History').where('userName', '==', userName).orderBy('date', 'desc');
    const querySnapshot = await q.get();

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
    const q = firestore.collection('balance').where('userName', '==', userName);
    const querySnapshot = await q.get();

    if (querySnapshot.empty) {
      res.status(400).send("User not found");
    } else {
      const userDoc = querySnapshot.docs[0];
      const userRef = userDoc.ref;

      await firestore.runTransaction(async (transaction) => {
        const docSnapshot = await transaction.get(userRef);

        if (!docSnapshot.exists) {
          throw new Error("User not found");
        }

        const currentBalance = docSnapshot.data().balance || 0;
        const newBalance = currentBalance + jumlah;
        transaction.update(userRef, { balance: newBalance });
      });

      await addHistory(firestore, userName, jumlah, "Dana Masuk");

      res.status(200).send({ message: "TopUp successful" });
    }
  } catch (error) {
    res.status(400).send(error.message);
  }
});

router.post('/transfer', async (req, res) => {
  const { userName, jumlah, tujuan } = req.body;

  try {
    const senderQuery = firestore.collection('balance').where('userName', '==', userName);
    const senderSnapshot = await senderQuery.get();

    if (senderSnapshot.empty) {
      return res.status(400).send({ message: "User not found" });
    }

    const senderDoc = senderSnapshot.docs[0];
    const senderData = senderDoc.data();

    if (senderData.balance === undefined || senderData.balance < jumlah) {
      return res.status(400).send({ message: "Insufficient balance" });
    }

    const recipientQuery = firestore.collection('balance').where('userName', '==', tujuan);
    const recipientSnapshot = await recipientQuery.get();

    if (recipientSnapshot.empty) {
      return res.status(400).send({ message: "Recipient not found" });
    }

    const recipientDoc = recipientSnapshot.docs[0];
    const recipientRef = recipientDoc.ref;

    await firestore.runTransaction(async (transaction) => {
      const senderDocSnapshot = await transaction.get(senderDoc.ref);
      const recipientDocSnapshot = await transaction.get(recipientRef);

      if (!senderDocSnapshot.exists || !recipientDocSnapshot.exists) {
        throw "User not found";
      }

      const newSenderBalance = senderDocSnapshot.data().balance - jumlah;
      const newRecipientBalance = recipientDocSnapshot.data().balance + jumlah;

      transaction.update(senderDoc.ref, { balance: newSenderBalance });
      transaction.update(recipientRef, { balance: newRecipientBalance });
    });

    await addHistory(firestore, userName, -jumlah, "Dana Keluar");
    await addHistory(firestore, tujuan, jumlah, "Dana Masuk");

    res.status(200).send({ message: "Transfer successful" });
  } catch (error) {
    res.status(400).send(error.message);
  }
});

module.exports = router;
