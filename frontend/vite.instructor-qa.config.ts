// TEST ONLY: real SPA against a local synthetic provider and Go backend.
import {defineConfig} from 'vite'
import react from '@vitejs/plugin-react'
export default defineConfig({plugins:[react()],server:{host:'127.0.0.1',port:18082,strictPort:true,proxy:{'/api':{target:'http://127.0.0.1:18080',changeOrigin:true}}}})
