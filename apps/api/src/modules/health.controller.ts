import { Controller, Get } from "@nestjs/common"; import { Public } from "../common/public.decorator.js";
@Controller("health") export class HealthController { @Public() @Get("live") live(){return{ok:true,service:"api"}} @Public() @Get("ready") ready(){return{ok:true}} }
