
const express = require("express");
const app = express();

const { createClient } = require("redis");
const client = createClient();




app.use(express.json());


const allProducts = ['Produto 1', 'Produto 2'];

const getAllProducts = async () => {
  const time = Math.random() * 5000

  return new Promise(res => {
    setTimeout(() => {
      res(allProducts)
    }, time)
  })
}

app.post("/", async (req, res) => {
  allProducts.push(`Produto ${allProducts.length + 1}`);
  return res.status(201).json(allProducts)
})


app.get('/saved', async (req, res) => {
  // saved a new product, reset the cache 
  // the best strategy is not to empty the cache

  await client.del('getAllProducts');
  return res.json({
    ok: true
  })
})

app.get("/", async (req, res) => {
  /** Redis insight -> redis workbench  */
  // await client.set("key", "value");
  // const value = await client.get("key");
  //  console.log(value)


  const productsFromCache = await client.get("getAllProducts") // the key should be unique
  // await client.del("getAllProducts");


  /** Stale while revalidate */

  const isProductFromCacheStale = await client.get("getAllProducts:validation");

  console.log({ isProductFromCacheStale });

  if (!isProductFromCacheStale) {
    const isRefetching = await client.get("getAllProducts:refetching");

    console.log({ isRefetching });

    // do not SET a new data if the refetching has not expired

    if (!!isRefetching) return;

    await client.set("getAllProducts:is-refetching", "true", { EX: 20 });
    setTimeout(async () => {
      console.log("cache is stale - refetching");
      const products = await getAllProducts();
      await client.set("getAllProducts", JSON.stringify(products));
      await client.set("getAllProducts:validation", "true", { EX: 5 });
      await client.del("getAllProducts:is-refetching");

    }, 0);
  }

  if (productsFromCache) {
    return res.status(200).json(JSON.parse(productsFromCache));
  }

  const products = await getAllProducts();

  await client.set("getAllProducts", JSON.stringify(products), { EX: 10 }); // expiration: 10s

  return res.status(200).json(products)
})


const startup = async () => {
  await client.connect();
  app.listen(3000, () => console.log(`Running`))
}


startup();