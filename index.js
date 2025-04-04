import express from 'express';
import  db  from './db.js'; 
import cors from 'cors';

const app = express();
app.use(cors());
app.use(express.json());
const PORT = 3000;

app.get('/get-users', (req, res) => {
    const query = "SELECT * FROM users";
    db.query(query)
    .then(users => {
        res.status(200).json({users: users.rows});
    });
})

app.get('/get-titles', (req, res) => {
    const query = "SELECT * FROM titles";
    db.query(query)
    .then(users => {
        res.status(200).json({users: users.rows});
    });
})

app.get('/get-lists', (req, res) => {
    const query = "SELECT * FROM lists";
    db.query(query)
    .then(users => {
        res.status(200).json({users: users.rows});
    });
})

app.post('/check-user', (req, res) =>{
    const {username, password } = req.body;

    const query = "SELECT * FROM accounts WHERE username=$1 AND password=$2";

    db.query(query, [username,password])
    .then(result => {
        if(result.rowCount > 0 ){
        res.status(200).json({ exist: true });
    }
    else {
     res.status(200).json({ exist: false });
    }
    });

});

app.post('/register', (req, res) => {
    const {username, password, fname, lname} = req.body;

    const query = "INSERT INTO accounts (username, password, fname, lname) VALUES ($1,$2,$3,$4)";
    db.query(query, [username,password, fname,lname])
    .then(result => {
        res.status(200).json({ exist: true });
    });
});

app.post('/add-titles', (req, res) => {
    const {id, username, title, date_modified, status} = req.body;

    const query = "INSERT INTO titles (id, username, title, date_modified, status) VALUES ($1,$2,$3,$4,$5)";
    db.query(query, [id, username, title, date_modified, status])
    .then(result => {
        res.status(200).json({ sucess: true });
    });
});

app.post('/add-lists', (req, res) => {
    const {id, title_id, list_desc, status} = req.body;

    const query = "INSERT INTO lists (id, title_id, list_desc, status) VALUES ($1,$2,$3,$4)";
    db.query(query, [id, title_id, list_desc, status])
    .then(result => {
        res.status(200).json({ sucess: true });
    });
});

app.post('/add-titles', (req, res) => {
    const { id, username, title, date_modified, status} = req.body;

    const query = "INSERT INTO titles (id, username, title, date_modified, status) VALUES ($1,$2,$3,$4,$5)";
    db.query(query, [id, username, title, date_modified, status])
    .then(result => {
        res.status(200).json({sucess: true});
    });
});
app.post('/add-to-do', async (req, res) => {
    const { username, titles, lists } = req.body;

    try {
      
        const result = await db.query(
            "INSERT INTO titles (username, title, date_modified, status) VALUES ($1, $2, NOW(), true) RETURNING id",
            [username, titles]
        );

        const title_id = result.rows[0].id; 

       
        const queries = lists.map(list_desc =>
            db.query(
                "INSERT INTO lists (title_id, list_desc, status) VALUES ($1, $2, true)",
                [title_id, list_desc]
            )
        );

        await Promise.all(queries); 

        res.status(200).json({
            success: "true",
            message: "Successfully Added"
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({
            success: "false",
            message: "Failed to insert data",
            error: error.message
        });
    }
});

app.post('/update-to-do', async (req, res) => {
    const { title_id, list } = req.body; // Ensure the request body uses "title_id" and "list"

    if (!title_id || !Array.isArray(list)) {
        return res.status(400).json({
            success: false,
            message: "Invalid request data",
            error: "title_id must be provided and list must be an array"
        });
    }

    try {
        // Update the title's date_modified
        await db.query(
            "UPDATE titles SET date_modified = NOW() WHERE id = $1",
            [title_id]
        );

        // Delete existing lists for this title
        await db.query("DELETE FROM lists WHERE title_id = $1", [title_id]);

        // Insert new lists
        const queries = list.map(list_desc =>
            db.query(
                "INSERT INTO lists (title_id, list_desc, status) VALUES ($1, $2, true)",
                [title_id, list_desc]
            )
        );

        await Promise.all(queries);

        res.status(200).json({
            success: true,
            message: "To-do successfully updated"
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Failed to update to-do",
            error: error.message
        });
    }
});

app.post('/update-status', async (req, res) => {
    const { tittle_id, list_id, status } = req.body;

    // Validate request body
    if (tittle_id === undefined || list_id === undefined || typeof status !== "boolean") {
        return res.status(400).json({
            success: false,
            message: "Invalid request data",
            error: "tittle_id, list_id must be provided, and status must be a boolean"
        });
    }

    try {
        await db.query("BEGIN"); // Start transaction

        // Check if the tittle_id exists
        const titleExists = await db.query(
            "SELECT id FROM tittles WHERE id = $1",
            [tittle_id]
        );

        if (titleExists.rowCount === 0) {
            await db.query("ROLLBACK");
            return res.status(404).json({
                success: false,
                message: "Tittle not found"
            });
        }

        // Check if the list_id exists under the given tittle_id
        const listExists = await db.query(
            "SELECT id FROM lists WHERE id = $1 AND tittle_id = $2",
            [list_id, tittle_id]
        );

        if (listExists.rowCount === 0) {
            await db.query("ROLLBACK");
            return res.status(404).json({
                success: false,
                message: "List item not found for the given tittle"
            });
        }

        // Update the list item status
        await db.query(
            "UPDATE lists SET status = $1 WHERE id = $2 AND tittle_id = $3",
            [status, list_id, tittle_id]
        );

        await db.query("COMMIT"); // Commit transaction

        res.status(200).json({
            success: true,
            message: "List status successfully updated"
        });

    } catch (error) {
        await db.query("ROLLBACK"); // Rollback if error occurs
        console.error("Error occurred during transaction:", error);
        res.status(500).json({
            success: false,
            message: "Failed to update list status",
            error: error.message
        });
    }
});

app.post('/delete-todo', async (req, res) => {
    const { tittle_id } = req.body; // Extract tittle_id from request body

    try {
        // 1️⃣ Check if tittle_id exists before attempting to delete
        const checkTitle = await db.query("SELECT * FROM tittles WHERE id = $1", [tittle_id]);

        if (checkTitle.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Title not found"
            });
        }

        // 2️⃣ Delete all lists associated with the given tittle_id
        const deletedLists = await db.query(
            "DELETE FROM lists WHERE tittle_id = $1 RETURNING *",
            [tittle_id]
        );

        // 3️⃣ Delete the title with the given tittle_id
        const deletedTitle = await db.query(
            "DELETE FROM tittles WHERE id = $1 RETURNING *",
            [tittle_id]
        );

        if (deletedTitle.rows.length === 0) {
            return res.status(500).json({
                success: false,
                message: "Failed to delete title"
            });
        }

        // 4️⃣ Return success response with deleted data
        res.status(200).json({
            success: true,
            message: "To-do Successfully Deleted",
            deletedTitle: deletedTitle.rows,
            deletedLists: deletedLists.rows
        });

    } catch (error) {
        console.error("Error deleting to-do:", error);
        res.status(500).json({
            success: false,
            message: "Failed to delete to-do",
            error: error.message
        });
    }
});

//INDEX ROUTE
app.get('/', (req, res) => {
    res.send('hello world');
});

app.get('/to do', (req, res) => {
    res.send('This is to-do homepage');
});

app.post('/add-to-do', (req, res) => {
    const {fname, lname} = req.body;
    res.send(`hello ${fname} ${lname}`);
});

app.get('/update-to-do', (req, res) => {
    res.send('This is to-do homepage');
});

app.get('/delete-to do', (req, res) => {
    res.send('This is to-do homepage');
});

app.listen(PORT, () => {
    console.log (`server is running on Port ${PORT} `);
});