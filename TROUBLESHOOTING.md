# 🔧 Troubleshooting Guide

## Common Issues and Solutions

### 1. **Blockchain Service Initialization Error**

**Error**: `Cannot find module '../../../blockchain/artifacts/contracts/...'`

**Solution**: The smart contracts haven't been compiled yet. Run:
```bash
npm run setup
```

Or manually:
```bash
cd blockchain
npm run compile
npm run deploy:localhost
```

### 2. **Backend Fails to Start**

**Error**: Port 4000 already in use

**Solution**: 
```bash
# Find process using port 4000
lsof -ti:4000

# Kill the process
kill -9 <PID>

# Or use a different port
PORT=4001 npm run dev:backend
```

### 3. **Frontend Can't Connect to Backend**

**Error**: `Failed to fetch` or CORS errors

**Solution**: 
- Make sure backend is running on port 4000
- Check if backend is accessible: `curl http://localhost:4000/health`
- Verify API_BASE_URL in frontend configuration

### 4. **Smart Contract Deployment Fails**

**Error**: `insufficient funds` or `nonce too low`

**Solution**:
```bash
# Stop existing blockchain node
npm run stop:blockchain

# Start fresh blockchain node
cd blockchain
npm run node

# In another terminal, deploy contracts
npm run deploy:localhost
```

### 5. **Wallet Connection Issues**

**Error**: MetaMask not detected or connection fails

**Solution**:
- Make sure MetaMask is installed and unlocked
- Check if you're on the correct network (localhost:8545 for development)
- Try refreshing the page
- Check browser console for detailed error messages

### 6. **Dependencies Installation Issues**

**Error**: `npm install` fails

**Solution**:
```bash
# Clear npm cache
npm cache clean --force

# Delete node_modules and reinstall
rm -rf node_modules package-lock.json
npm install

# Or use the setup script
npm run setup
```

### 7. **Hardhat Node Issues**

**Error**: Port 8545 already in use

**Solution**:
```bash
# Find and kill process using port 8545
lsof -ti:8545 | xargs kill -9

# Or use a different port
cd blockchain
npx hardhat node --port 8546
```

### 8. **Contract ABI Loading Issues**

**Error**: Contract artifacts not found

**Solution**:
```bash
# Make sure contracts are compiled
cd blockchain
npm run compile

# Check if artifacts folder exists
ls -la artifacts/contracts/

# If artifacts are missing, try clean compilation
npx hardhat clean
npm run compile
```

### 9. **Database/Storage Issues**

**Error**: Data not persisting or posts not loading

**Solution**: 
- The current implementation uses in-memory storage
- Restarting the backend will clear all data
- For production, implement a real database

### 10. **Performance Issues**

**Symptoms**: Slow loading, laggy UI

**Solution**:
- Check browser console for errors
- Verify all services are running
- Check network tab for slow API calls
- Consider implementing caching

## 🔍 Debug Mode

Enable debug logging by setting environment variables:

```bash
# Backend debug
DEBUG=* npm run dev:backend

# Frontend debug (check browser console)
npm run dev:frontend
```

## 📊 Health Checks

Check if all services are running:

```bash
# Backend health
curl http://localhost:4000/health

# Blockchain status
curl http://localhost:4000/api/blockchain/status

# Frontend (should show React app)
curl http://localhost:5173
```

## 🚨 Emergency Reset

If everything is broken, reset the entire project:

```bash
# Stop all processes
npm run stop:blockchain
pkill -f "npm run dev"

# Clean everything
cd blockchain
npx hardhat clean
cd ..

# Reinstall and setup
rm -rf node_modules frontend/node_modules backend/node_modules blockchain/node_modules
npm run setup
```

## 📞 Getting Help

1. **Check the logs**: Look at terminal output for error messages
2. **Browser console**: Check for JavaScript errors
3. **Network tab**: Verify API calls are working
4. **GitHub Issues**: Search for similar problems
5. **Community**: Ask in our Discord or forums

## 🎯 Quick Fixes

| Problem | Quick Fix |
|---------|-----------|
| Contracts not working | `npm run setup` |
| Backend won't start | `lsof -ti:4000 \| xargs kill -9` |
| Frontend errors | Clear browser cache, refresh |
| Blockchain issues | `npm run stop:blockchain && cd blockchain && npm run node` |
| Dependencies | `rm -rf node_modules && npm run install:all` |

---

**Remember**: Most issues can be resolved by running `npm run setup` which handles the complete setup process automatically! 🚀
