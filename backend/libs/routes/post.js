import express from "express"
import { postModle } from "../../libs/models/index.mjs"
import { isValidObjectId } from "mongoose"


const router = express.Router()


router.post("/post", async(req,res)=>{
    try {

        if(!req.body.title){
            return res.status(400).send({
                message : "title is requioired"
            })
        }
        if(!req.body.description){
            return res.status(400).send({
                message : "Desciption is required "
            })
        }

        await postModle.create({
            title :req.body.title,
            description : req.body.description,
        })
        return res.send({
            message:"post is created"
        })
    } catch (error) {
         console.error(error)
         return res.status(500).send({
            message : "internal server error"
         })
    }
})


router.get("/post", async(req,res)=>{


    try {
 
        console.log("currentUser from post api==>",req.currentUser)
        const allPosts = await postModle.find()
        return res.send({
            message:"all post is fetched",

               posts: allPosts
        })
    } catch (error) {
         console.error(error)
         return res.status(500).send({
            messaage : "internal server error"
         })
    }
})


router.get("/post/:postId", async(req,res)=>{
    try {

        const postId = req.params.postId

        if(!postId){
            return res.status(400).send({
            message : "id is required"
        })}

        if(!isValidObjectId(postId)){
           return res.status(400).send({
            message : "id is invalid"
        })
        }
        const solopost = await postModle.findOne({_id :req.params.postId })

        if(!solopost){
            return res.status(404).send({
                message : "post not found"
            })
        }
        return res.send({
            message:"single post is fetched",
            post: solopost
        })
    } catch (error) {
         console.error(error)
         return res.status(500).send({
            messaage : "internal server error"
         })
    }
})


router.delete("/post/:postId", async (req, res) => {
    try {

        const postId = req.params.postId

  

        if (!postId) {
            return res.status(400).send({
                message: "id is required"
            })
        }

        if (!isValidObjectId(postId)) {
            return res.status(400).send({
                message: "id is invalid"
            })
        }


        const deletedPost = await postModle.findByIdAndDelete(postId)

        if (!deletedPost) {
            return res.status(404).send({
                message: "post not found"
            })
        }

        return res.send({
            message: "single post deleted",
            post: deletedPost
        })

    } catch (error) {
        console.error(error)

        return res.status(500).send({
            message: "internal server error"
        })
    }
})

router.put("/post/:postId",  async(req,res)=>{
    try {

        const postId = req.params.postId

        if(!postId){
            return res.status(400).send({
            message : "id is required"
        })}

        if(!isValidObjectId(postId)){
           return res.status(400).send({
            message : "id is invalid"
        })
        }

        if(!req.body.title){
            return res.status(400).send({
                message : "title is required"
            })
        }
        if(!req.body.description){
            return res.status(400).send({
                message : "Description is required"
            })
        }

        const updatedPost = await postModle.findByIdAndUpdate({_id : postId},{
            $set :{
                title :req.body.title,
                description : req.body.description,
            }
        }, { new: true })

        return res.send({
            message:"single post updated",
            post: updatedPost
        })
    } catch (error) {
         console.error(error)
         return res.status(500).send({
            message : "internal server error"
         })
    }
})

export default router

