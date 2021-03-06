const User = require("../../../src/models/user");
const createUser = require("../../fixtures/createUser");
const Folder = require("../../../src/models/folder");
const mongoose = require("../../../src/db/mongoose");
const conn = mongoose.connection;
const crypto = require("crypto");
const createFile = require("../../fixtures/createFile");
const path = require("path");
const ObjectID = require('mongodb').ObjectID
const FolderService = require("../../../src/services/FolderService");
const folderService = new FolderService();

let user;
let folder;

beforeEach(async(done) => {

    if (conn.readyState === 0) {

        conn.once("open", async() => {

            const {user: gotUser} = await createUser();
            user = gotUser;

            const folderData = {
                name: "bunny",
                parent: "/",
                owner: user._id,
                parentList: ["/"]
            }
    
            folder = new Folder(folderData);
            await folder.save();

            done();
        })

    } else {
        
        // user = await createUser();
        const {user: gotUser} = await createUser();
        user = gotUser;
        
        const folderData = {
            name: "bunny",
            parent: "/",
            owner: user._id,
            parentList: ["/"]
        }

        folder = new Folder(folderData);
        await folder.save();

        done();
    }
    
})

afterEach(async(done) => {

    let bucket = new mongoose.mongo.GridFSBucket(conn.db);

    await User.deleteMany({});
    await Folder.deleteMany({});

    // const gfs = Grid(conn.db, mongoose.mongo);

    const allFiles = await conn.db.collection("fs.files").find({}).toArray();

    for (let i = 0; i < allFiles.length; i++) {

        const currentFileID = allFiles[i]._id;
        await bucket.delete(ObjectID(currentFileID));
    }

    done();
})

test("When giving userID and folderID, should return folder info" , async() => {

    const userID = user._id;
    const folderID = folder._id;

    const receivedFolder = await folderService.getFolderInfo(userID, folderID);

    expect(receivedFolder._id).toEqual(folderID);
})

test("When giving the wrong userID for folder info, should return not found error", async() => {

    const wrongUserID = "123456789012";
    const folderID = folder._id;

    await expect(folderService.getFolderInfo(wrongUserID, folderID)).rejects.toThrow();
})

test("When giving userID and folderID, should return subfolder list", async() => {

    const userID = user._id;
    const folderID = folder._id;

    const {folderNameList, folderIDList} = await folderService.getFolderSublist(userID, folderID);

    expect(folderNameList.length).toBe(2);
    expect(folderIDList.length).toBe(2);
})

test("When giving the wrong userID for subfolder list, should throw not found error", async() => {

    const wrongUserID = "123456789012";
    const folderID = folder._id;

    await expect(folderService.getFolderSublist(wrongUserID, folderID)).rejects.toThrow();
})

test("When giving userID and query with default values, should return folder list", async() => {

    const userID = user._id;


    const receivedFolderList = await folderService.getFolderList(userID, {});

    
    expect(receivedFolderList.length).toBe(1);
})

test("When giving wrong userID for folder list, should return empty list", async() => {

    const wrongUserID = "123456789012";


    const receivedFolderList = await folderService.getFolderList(wrongUserID, {});

    
    expect(receivedFolderList.length).toBe(0);
})

test("When giving userID, folderID, and title, should rename folder", async() => {

    const userID = user._id;
    const folderID = folder._id;
    const title = "coconot";

    await folderService.renameFolder(userID, folderID, title);
    const updatedFolder = await Folder.findById(folderID);

    expect(updatedFolder.name).toBe(title);
})

test("When giving wrong userID for rename folder, should throw not found error", async() => {

    const wrongUserID = "123456789012";
    const folderID = folder._id;
    const title = "coconot";


    await expect(folderService.renameFolder(wrongUserID, folderID, title)).rejects.toThrow();
})

test("When giving userID, folderID, and parentID, should move folder", async() => {

    const newFolder = new Folder({
        name: "new folder",
        owner: user._id,
        parent: "1234",
        parentList: ["/", "1234"]??
    })

    await newFolder.save();

    const userID = user._id;
    const folderID = folder._id;
    const parentID = newFolder._id;


    await folderService.moveFolder(userID, folderID, parentID);
    const updatedFolder = await Folder.findById(folderID);


    expect(updatedFolder.parent.toString()).toBe(parentID.toString());
})

test("When giving the wrong userID for move folder, should throw new found error", async() => {

    const newFolder = new Folder({
        name: "new folder",
        owner: user._id,
        parent: "1234",
        parentList: ["/", "1234"]??
    })

    await newFolder.save();

    const wrongUserID = "123456789012";
    const folderID = folder._id;
    const parentID = newFolder._id;

    await expect(folderService.moveFolder(wrongUserID, folderID, parentID)).rejects.toThrow()  
})

test("When giving a parentID that does not exist for move folder, should throw not found error", async() => {

    const userID = user._id;
    const folderID = folder._id;
    const wrongParentID = "123456789012";

    await expect(folderService.moveFolder(userID, folderID, wrongParentID)).rejects.toThrow() 
})

test("When giving userID, folderID, and parentID, for folder with subitems, should move all items", async() => {

    const userID = user._id;

    const folderOne =  new Folder({
        name: "new folder",
        owner: user._id,
        parent: "/",
        parentList: ["/"]??
    })

    const folderID = folderOne._id;

    await folderOne.save();

    const folderTwo = new Folder({
        name: "new folder 2",
        owner: user._id,
        parent: folderOne._id,
        parentList: ["/", folderOne._id.toString()]??
    })

    await folderTwo.save();

    const folderThree = new Folder({
        name: "new folder3 ",
        owner: user._id,
        parent: folderTwo._id,
        parentList: ["/", folderOne._id.toString(), folderTwo._id.toString()]??
    })

    await folderThree.save();

    const folderFour = new Folder({
        name: "new folder 4",
        owner: user._id,
        parent: "/",
        parentList: ["/"]??
    })

    const parentID = folderFour._id;

    await folderFour.save();

    process.env.KEY = "1234";

    const initVect = crypto.randomBytes(16);
    const filename = "bunny.png";
    const filepath = path.join(__dirname, "../../fixtures/media/check.svg")
    const metadata = {
        owner: user._id,
        parent: folderOne._id.toString(),
        parentList: "/,"+folderOne._id.toString(),
        "IV": initVect
    }

    const fileOne = await createFile(filename, filepath, metadata, user);

    const metadataTwo = {
        owner: user._id,
        parent: folderTwo._id.toString(),
        parentList: "/,"+folderTwo._id.toString(),
        "IV": initVect
    }

    const fileTwo = await createFile(filename, filepath, metadataTwo, user);

    const metadataThree = {
        owner: user._id,
        parent: folderThree._id.toString(),
        parentList: "/,"+folderThree._id.toString(),
        "IV": initVect
    }

    const fileThree = await createFile(filename, filepath, metadataThree, user);



    await folderService.moveFolder(userID, folderID, parentID);
    const updatedFolderOne = await Folder.findById(folderOne._id);
    const updatedFolderTwo = await Folder.findById(folderTwo._id);
    const updatedFolderThree = await Folder.findById(folderThree._id);
  


    expect(updatedFolderOne.parent.toString()).toBe(parentID.toString());
    expect(updatedFolderOne.parentList[0].toString()).toBe("/");
    expect(updatedFolderOne.parentList[1].toString()).toBe(parentID.toString());
    expect(updatedFolderOne.parentList.length).toBe(2);

    expect(updatedFolderTwo.parentList[0].toString()).toBe("/");
    expect(updatedFolderTwo.parentList[1].toString()).toBe(parentID.toString());
    expect(updatedFolderTwo.parentList[2].toString()).toBe(folderOne._id.toString());
    expect(updatedFolderTwo.parentList.length).toBe(3);

    expect(updatedFolderThree.parentList[0].toString()).toBe("/");
    expect(updatedFolderThree.parentList[1].toString()).toBe(parentID.toString());
    expect(updatedFolderThree.parentList[2].toString()).toBe(folderOne._id.toString());
    expect(updatedFolderThree.parentList[3].toString()).toBe(folderTwo._id.toString());
    expect(updatedFolderThree.parentList.length).toBe(4);
})