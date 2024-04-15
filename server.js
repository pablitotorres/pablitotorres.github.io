const express = require('express');
const { MongoClient } = require('mongodb');
const session = require('express-session');
const { ObjectId } = require('mongodb');

const app = express();
const PORT = 3000;
const MONGODB_URI = 'mongodb://127.0.0.1:27017';

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(__dirname + '/public'));

// Session middleware setup
app.use(session({
  secret: 'your-strong-unique-secret',
  resave: false,
  saveUninitialized: true,
}));

// MongoDB client for connection pooling
const client = new MongoClient(MONGODB_URI);

const userCollection = client.db('register').collection('user');
const ticketsCollection = client.db('register').collection('ticket');
const cruiseScheduleCollection = client.db('register').collection('cruiseSchedule');

// Define a function to generate the script for the pop-up
function generatePopupScript(message, redirectUrl) {
  return `<script>alert("${message}. Click OK to proceed."); window.location.href="${redirectUrl}";</script>`;
}

// Error handling middleware for specific errors
app.use((err, req, res, next) => {
  if (err.name === 'UnauthorizedError') {
    // Handle unauthorized access
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (err.name === 'ValidationError') {
    // Handle validation errors
    return res.status(422).json({ error: err.message });
  }

  // Handle other errors
  console.error('Error:', err);
  res.status(500).json({ error: 'Internal Server Error' });
});

app.use(async (req, res, next) => {
  try {
    await client.connect();
    res.on('finish', async () => {
      try {
        await client.close();
      } catch (error) {
        console.error('Error closing MongoDB client:', error);
      }
    });
    next();
  } catch (error) {
    next(error);
  }
});

// New route to get user data
app.get('/get-user', async (req, res, next) => {
  try {
    if (!req.session.userEmail) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    await client.connect();
    const database = client.db('register');
    const collection = database.collection('user');

    const userEmail = req.session.userEmail;
    const user = await collection.findOne({ email: userEmail });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(user);
  } catch (error) {
    next(error);
  }
  
});

app.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const isValidCredentials = await checkCredentials(email, password);

    if (isValidCredentials) {
      req.session.userEmail = email;
      res.json({ success: true, message: 'Login successful' });
    } else {
      res.status(401).json({ success: false, error: 'Invalid credentials' });
    }
  } catch (error) {
    console.error('Error during login:', error);
    res.status(500).json({ success: false, error: 'Error during login. Please try again.' });
  }
});

async function checkCredentials(email, password) {
  try {
    await client.connect();
    const database = client.db('register');
    const collection = database.collection('user');

    const user = await collection.findOne({ email, password });

    return !!user;
  } finally {
    await client.close();
  }
}

app.post('/register', async (req, res) => {
  let client;

  try {
    const { firstname, lastname, email, password, confirmPassword, city, age, phoneNum, emergencyNum } = req.body;
    client = new MongoClient(MONGODB_URI);

    await client.connect();
    const database = client.db('register');
    const collection = database.collection('user');
    const existingUser = await collection.findOne({ email });

    if (existingUser) {
      res.send(generatePopupScript('Email already registered', '/'));
    } else {
      await collection.insertOne({ firstname, lastname, email, password, city, age, phoneNum, emergencyNum });
      res.send(generatePopupScript('Registration successful', '/'));
    }
  } catch (error) {
    console.error('Error during registration:', error);
    res.send(generatePopupScript('Error during registration. Please try again.'));
  } finally {
    if (client) {
      await client.close();
    }
  }
});

// function to get user data
async function getUserData(email) {
  await client.connect();
  const database = client.db('register');
  const collection = database.collection('user');
  return await collection.findOne({ email });
}

app.post('/update-profile', async (req, res, next) => {
  try {
    if (!req.session.userEmail) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    await client.connect();
    const database = client.db('register');
    const userCollection = database.collection('user');
    const userEmail = req.session.userEmail;

    const user = await userCollection.findOne({ email: userEmail });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const { city, phoneNum } = req.body;

    console.log('Update Profile Data:', { city, phoneNum });

    // Update user profile information
    const updateResult = await userCollection.updateOne(
      { email: userEmail },
      { $set: { city, phoneNum } }
    );

    console.log('Update Result:', updateResult);

    if (updateResult.modifiedCount === 1) {
      // Retrieve the updated user information
      const updatedUser = await userCollection.findOne({ email: userEmail });

      console.log('Updated User Information:', updatedUser);

      // Send the updated user information as the response
      return res.json({ success: true, message: 'Profile updated successfully', updatedUser });
    } else {
      return res.status(500).json({ success: false, error: 'Error updating profile' });
    }
  } catch (error) {
    next(error);
  } finally {
    // Close the MongoDB client after the response is sent
    await client.close();
  }
});

// Place this function definition somewhere in your server-side code
function calculateDepartureDate(selectedSailingDate) {
  const sailingDate = new Date(selectedSailingDate);
  const departureDate = new Date(sailingDate);
  departureDate.setDate(sailingDate.getDate() + 3);
  return `${departureDate.getMonth() + 1}/${departureDate.getDate()}/${departureDate.getFullYear()}`;
}

function generateSeatNumber() {
  // Logic to generate a random number between 1 and 3000
  return Math.floor(1 + Math.random() * 3000);
}

app.get('/get-cruise-schedule', async (req, res, next) => {
  try {
    await client.connect();
    const cruiseScheduleData = await cruiseScheduleCollection.find().toArray();
    res.json(cruiseScheduleData);
  } catch (error) {
    next(error);
  } finally {
    await client.close();
  }
});

app.post('/add-cruise-schedule', async (req, res, next) => {
  try {
    const { cruiseShip, cruisePort, cruiseDeparture, cruiseArrival } = req.body;

    if (!cruiseShip || !cruisePort || !cruiseDeparture || !cruiseArrival) {
      return res.status(400).json({ error: 'Incomplete cruise schedule details' });
    }

    await client.connect();
    const result = await cruiseScheduleCollection.insertOne({
      cruiseShip,
      cruisePort,
      cruiseDeparture,
      cruiseArrival,
    });

    if (result && result.acknowledged && result.insertedId) {
      res.json({ success: true, message: 'Cruise schedule added successfully' });
    } else {
      console.error('Error adding cruise schedule:', result);
      res.status(500).json({ success: false, error: 'Error adding cruise schedule' });
    }
  } catch (error) {
    next(error);
  } finally {
    await client.close();
  }
});

async function storeTicket(ticketsCollection, cruiseScheduleCollection, ticket) {
  try {
    const result = await ticketsCollection.insertOne(ticket);

    if (result && result.acknowledged && result.insertedId) {
      console.log('Ticket stored successfully:', ticket);

      // Also add the cruise schedule data when storing a ticket
      const cruiseScheduleResult = await cruiseScheduleCollection.insertOne({
        cruiseShip: ticket.cruise,
        cruisePort: ticket.port,
        cruiseDeparture: ticket.sailingDate,
        cruiseArrival: ticket.departureDate,
      });

      if (cruiseScheduleResult && cruiseScheduleResult.acknowledged && cruiseScheduleResult.insertedId) {
        console.log('Cruise schedule added successfully:', cruiseScheduleResult);
      } else {
        console.error('Error adding cruise schedule:', cruiseScheduleResult);
      }

      return true; // Ticket insertion successful
    } else {
      console.error('Error storing ticket details: Invalid result from MongoDB insertion');
      return false; // Ticket insertion failed
    }
  } catch (error) {
    console.error('Error storing ticket details:', error);
    return false; // Ticket insertion failed
  }
}

app.post('/reserve-now', async (req, res) => {
  const session = client.startSession();
  
  try {
    await session.withTransaction(async () => {
      // Check if the user is authenticated
      if (!req.session.userEmail) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const userEmail = req.session.userEmail;
      const user = await getUserData(userEmail);

      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      // Check if the user already has an active ticket
      const activeTicket = await ticketsCollection.findOne({
        email: user.email,
        revoked: false,
      });

      if (activeTicket) {
        return res.status(400).json({ error: 'User already has an active ticket' });
      }

      const { destination, sailingDate, cruise, port } = req.body;

      // Additional validation for user input
      if (!destination || !sailingDate || !cruise || !port) {
        return res.status(400).json({ error: 'Incomplete reservation details' });
      }

      // Calculate departure date and generate seat number
      const departureDate = calculateDepartureDate(sailingDate);
      const seatNumber = generateSeatNumber();

      // Create the ticket object
      const ticket = {
        userId: user._id,
        firstname: user.firstname,
        lastname: user.lastname,
        email: user.email,
        phoneNum: user.phoneNum,
        destination,
        sailingDate,
        cruise,
        port,
        departureDate,
        seatNumber,
        timestamp: new Date(),
      };

      // Use the storeTicket function to insert the data into the database
      const resultTicket = await storeTicket(ticketsCollection, cruiseScheduleCollection, ticket);

      if (resultTicket) {
        res.json({ message: 'Reservation successful. Ticket details stored.', ticketDetails: ticket });
      } else {
        res.status(500).json({ error: 'Error storing ticket details' });
      }
    });
  } catch (error) {
    console.error('Error during reservation:', error);
    res.status(500).json({ error: `Internal Server Error: ${error.message}` });
  } finally {
    session.endSession();
  }
});

app.get('/get-ticket-details', async (req, res) => {
  try {
    // Check if the user is authenticated
    if (!req.session.userEmail) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const userEmail = req.session.userEmail;
    const user = await getUserData(userEmail);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Retrieve the user's latest ticket details
    const latestTicket = await ticketsCollection.findOne(
      { email: user.email },
      { sort: { timestamp: -1 } }
    );

    if (!latestTicket) {
      return res.status(404).json({ error: 'Ticket not found' });
    }

    res.json(latestTicket);
  } catch (error) {
    console.error('Error fetching ticket details:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Add a new route to handle ticket deletion
app.post('/delete-ticket', async (req, res) => {
  try {
    // Ensure the user is logged in
    if (!req.session.userEmail) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const userEmail = req.session.userEmail;
    const user = await getUserData(userEmail);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const { ticketId } = req.body;

    // Use the modified deleteTicket function to handle ticket deletion, passing both collections as parameters
    const result = await deleteTicket(ticketsCollection, cruiseScheduleCollection, user.email, ticketId);

    if (result.success) {
      res.json({ message: 'Ticket deleted successfully' });
    } else {
      res.status(500).json({ error: result.error || 'Error deleting ticket' });
    }
  } catch (error) {
    console.error('Error deleting ticket:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Updated deleteTicket function to remove corresponding cruise schedule data
async function deleteTicket(ticketsCollection, cruiseScheduleCollection, userEmail, ticketId) {
  try {
    const ticketObjectId = new ObjectId(ticketId);

    // Fetch the ticket details before deletion
    const ticket = await ticketsCollection.findOne({
      email: userEmail,
      _id: ticketObjectId,
    });

    if (!ticket) {
      console.error('Ticket not found:', ticketId);
      return { success: false, error: 'Ticket not found' };
    }

    // Delete the ticket
    const deleteResult = await ticketsCollection.deleteOne({
      email: userEmail,
      _id: ticketObjectId,
    });

    if (deleteResult.deletedCount !== 1) {
      console.error('Error deleting ticket:', deleteResult);
      return { success: false, error: 'Error deleting ticket' };
    }

    // Remove the corresponding cruise schedule data
    const cruiseScheduleDeleteResult = await cruiseScheduleCollection.deleteOne({
      cruiseShip: ticket.cruise,
      cruisePort: ticket.port,
      cruiseDeparture: ticket.sailingDate,
      cruiseArrival: ticket.departureDate,
    });

    if (cruiseScheduleDeleteResult.deletedCount !== 1) {
      console.error('Error deleting cruise schedule data:', cruiseScheduleDeleteResult);
      return { success: false, error: 'Error deleting cruise schedule data' };
    }

    return { success: true }; // Return success without updated ticket information
  } catch (error) {
    console.error('Error deleting ticket:', error);
    return { success: false, error: 'Internal Server Error' };
  }
}

// Handle 404 errors for undefined routes
app.use((req, res) => {
  res.status(404).json({ error: 'Not Found' });
});

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
