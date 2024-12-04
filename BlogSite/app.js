const express = require('express');
const session = require('express-session');
const bodyParser = require('body-parser');
const mongoose = require('mongoose');
const dotEnv = require('dotenv');
const ejs = require('ejs');

dotEnv.config();
const app = express();
const port = process.env.PORT || 3000;

const username = process.env.USER;
const password = process.env.PASS;

// mongo db connection url
let url = `mongodb+srv://${username}:${password}@cluster0.ctsfbwo.mongodb.net/testTask-2`;
// mongodb+srv://<username>:<password>@cluster0.ctsfbwo.mongodb.net/?retryWrites=true&w=majority

// Set up session middleware
app.use(session({
    secret: 'your-secret-key', // Change this to a random string
    resave: false,
    saveUninitialized: true
}));

// Use bodyParser to parse POST request data
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
// Set up static files directory
app.use(express.static('public'));
app.set('view engine', 'ejs');

// Middleware to check if the user is authenticated
const authenticateUser = (req, res, next) => {
    if (req.session && req.session.email) {
        next();
    } else {
        res.redirect('/login');
    }
};


// connect to the mongoDB database
mongoose.connect(url, {
    useNewUrlParser : true,
    useUnifiedTopology : true,
});

// Define Schema (similar to creating a table in sql)
let dbSchema = new mongoose.Schema({
    name: String,
    email: {
        type: String,
        unique: true, // Ensures uniqueness at the database level
        required: true,
    },
    password: String,
    blogs: [
        {
            title: String,
            content: String,
            name: String,
        }
    ]
});

// define model for that schema
let userModel = mongoose.model("user", dbSchema);

/* Set up routes */

// Signup page
app.get('/signup', (req, res) => {
    res.sendFile(__dirname + '/public/signup.html');
});

// post request from signup page
app.post('/signup', async (req, res) => {
    try {
        const { name, email, password } = req.body;
        let existingUser = await userModel.findOne({ email : email });
        if (!existingUser){
            // create object for the model
            let dataObj = new userModel({
                name,
                email,
                password
            });
            await dataObj.save();
            res.redirect('/login');
        }
        else {
            console.log('user already exists');
            res.redirect('/error');
        }
    }
    catch (error) {
        console.log(error);
        res.redirect('/error');
    }
});


// Login page
app.get('/login', (req, res) => {
    // check if session already exists
    if (req.session.email) {
        res.redirect('/home');
    }
    res.sendFile(__dirname + '/public/login.html');
});

// Home page (protected route)
app.get('/home', authenticateUser, (req, res) => {
    res.sendFile(__dirname + '/public/home.html');
});

// Handling login POST request
app.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        // Fetch the user from the database based on email and password
        const user = await userModel.findOne({ email, password });

        if (user) {
            req.session.email = email;
            req.session.password = password;
            res.redirect('/home');
        } else {
            console.log('Invalid credentials');
            res.redirect('/error');
        }
    } catch (error) {
        console.log(error);
        res.redirect('/error');
    }
});

// create Blog page
app.get('/createBlog', authenticateUser,(req, res)=> {
    res.sendFile(__dirname + '/public/createblog.html');
});


// post request from create blog page
// Handling create blog POST request
app.post('/createBlog', async (req, res) => {
    try {
        
        const { blogTitle, blogContent, authorName } = req.body;

        // Fetch the user from the database
        const user = await userModel.findOne({ email: req.session.email });
        if (!user) {
            console.log('User not found');
            res.redirect('/error');
            return;
        }
        // Ensure the 'blogs' property exists on the user object
        if (!user.blogs) {
            user.blogs = [];
        }
        // Add the new blog to the user's blogs array
        user.blogs.push({ title: blogTitle, content: blogContent, name: authorName });

        // Save the updated user object
        await user.save();

        res.redirect('/success');
    } catch (error) {
        console.log(error);
        res.redirect('/error');
    }
});

// Add this route to render a simple EJS view with a particular user's blogs
app.get('/viewBlogs', authenticateUser,async (req, res) => {
    try {
        // Fetch the user from the database
        const user = await userModel.findOne({ email: req.session.email });

        if (!user) {
            console.log('User not found');
            res.status(404).json({ error: 'User not found' });
            return;
        }

        // Render the view with the user's blogs
        res.render('viewBlogs', { blogs: user.blogs || [] });
    } catch (error) {
        console.log(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Add this route to render a simple EJS view with all blogs from all users
app.get('/allBlogs', authenticateUser ,async (req, res) => {
    try {
        // Fetch all users from the database
        const allUsers = await userModel.find();
        
        if (!allUsers) {
            console.log('No Users found');
            res.status(404).json({ error: 'No users found' });
            return;
        }
        // Extract all blogs from each user
        const allBlogs = allUsers.reduce((blogs, user) => {
            return blogs.concat(user.blogs || []);
        }, []);

        // Render the view with all blogs
        res.render('allBlogs', { blogs: allBlogs });
    } catch (error) {
        console.log(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});



// Logout
app.get('/logout', (req, res) => {
    req.session.destroy(() => {
        res.redirect('/login');
    });
});


app.get('/success', (req, res) => {
    res.sendFile(__dirname + '/public/success.html');
})
app.get('/error', (req, res) => {
    res.sendFile(__dirname + '/public/error.html');
})

// Start the server
app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
});
