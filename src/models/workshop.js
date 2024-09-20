const mongoose = require('mongoose')

const workshopSchema = mongoose.Schema({
   name:{
    type:String,
    required:[true,'Name is required']
   },
   guardianName:{
    type:String,
    required:[true,"Guardian's name is required"]
   },
   guardianContact:{
    type:String,
    required:[true,"Guardian's phone no is required"]
   },
   city:{
    type:String,
    required:[true,"City is required"]
   },
   message:{
    type:String,
   },
   appliedWorkshop:{
    type:String,
    enum:['BUDDY CAMP','TEEN CAMP','FAMILY CAMP'],
    required:[true,"Applied workshop is required"]
   },
   age:{
    type:String,
    required:[true,"Age is required"]
   },
})

const WorkshopData = mongoose.model('WorkshopData',workshopSchema)

module.exports = WorkshopData