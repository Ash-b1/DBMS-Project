
    require('dotenv').config();

    const bcrypt = require('bcryptjs');
    const pool = require('../db');

    const DOCTOR_PASSWORD = process.env.doctor_password;
    const ADMIN_PASSWORD = process.env.admin_password;

    const doctors = [
    { username: 'doc1', email: 'doc1@example.com', doctor_id: 201 },
    { username: 'doc2', email: 'doc2@example.com', doctor_id: 202 },
    { username: 'doc3', email: 'doc3@example.com', doctor_id: 203 }
    ];

    const admin = {
    username: 'admin1',
    email: 'admin1@example.com'
    };

    async function createAccounts() {
    let connection;

    try {
        connection = await pool.getConnection();
        await connection.beginTransaction();

        // Verify that all three doctors already exist.
        for (const doctor of doctors) {
        const [records] = await connection.execute(
            'SELECT doctor_id FROM doctor WHERE doctor_id = ?',
            [doctor.doctor_id]
        );

        if (records.length === 0) {
            throw new Error(
            `Doctor ID ${doctor.doctor_id} does not exist in the doctor table.`
            );
        }
        }

        // Check that none of the requested accounts already exists.
        const accounts = [
        ...doctors.map(doctor => ({
            ...doctor,
            role: 'DOCTOR'
        })),
        {
            ...admin,
            role: 'ADMIN',
            doctor_id: null
        }
        ];

        for (const account of accounts) {
        const [existing] = await connection.execute(
            `SELECT user_id
            FROM users
            WHERE username = ?
                OR email = ?
                OR (? IS NOT NULL AND doctor_id = ?)
            LIMIT 1`,
            [
            account.username,
            account.email,
            account.doctor_id,
            account.doctor_id
            ]
        );

        if (existing.length > 0) {
            throw new Error(
            `An account already exists for username ${account.username}, ` +
            `email ${account.email}, or its doctor ID. No accounts were committed.`
            );
        }
        }

        // Create the three doctor accounts.
        for (const doctor of doctors) {
        const passwordHash = await bcrypt.hash(DOCTOR_PASSWORD, 12);

        await connection.execute(
            `INSERT INTO users
            (username, email, password_hash, role, doctor_id, is_active)
            VALUES (?, ?, ?, 'DOCTOR', ?, 1)`,
            [
            doctor.username,
            doctor.email,
            passwordHash,
            doctor.doctor_id
            ]
        );

        console.log(`Prepared doctor account: ${doctor.username}`);
        }

        // Create the admin account.
        const adminPasswordHash = await bcrypt.hash(ADMIN_PASSWORD, 12);

        await connection.execute(
        `INSERT INTO users
            (username, email, password_hash, role, doctor_id, is_active)
        VALUES (?, ?, ?, 'ADMIN', NULL, 1)`,
        [
            admin.username,
            admin.email,
            adminPasswordHash
        ]
        );

        console.log(`Prepared admin account: ${admin.username}`);

        // Commit only after all four accounts have been inserted.
        await connection.commit();

        console.log('\nAll four accounts were created successfully.');
        console.log('Doctor accounts: doc1, doc2, doc3');
        console.log('Admin account: admin1');
    } catch (error) {
        if (connection) {
        await connection.rollback();
        }

        console.error('\nFailed to create accounts:');
        console.error(error.message);
        process.exitCode = 1;
    } finally {
        if (connection) {
        connection.release();
        }

        await pool.end();
    }
    }

    createAccounts();
