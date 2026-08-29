import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { FastifyAdapter, type NestFastifyApplication } from "@nestjs/platform-fastify";
import { SwaggerModule, DocumentBuilder } from "@nestjs/swagger";
import { AppModule } from "./app.module.js";
async function bootstrap(){
 const app=await NestFactory.create<NestFastifyApplication>(AppModule,new FastifyAdapter({trustProxy:true}));
 app.getHttpAdapter().getInstance().addContentTypeParser("application/x-www-form-urlencoded",{parseAs:"string"},(_req:any,body:string,done:any)=>done(null,body));
 app.setGlobalPrefix("api/v1");
 app.enableCors({origin:(process.env.CORS_ORIGINS||"http://localhost:3000").split(","),credentials:true});
 const config=new DocumentBuilder().setTitle("WebPilot API").setVersion("1").addBearerAuth().build();
 SwaggerModule.setup("docs",app,SwaggerModule.createDocument(app,config));
 await app.listen(Number(process.env.PORT||4000),"0.0.0.0");
}
bootstrap();
