import asyncHandler from '../utils/asyncHandler';
import * as catalogService from '../services/catalogService';

export const listGames = asyncHandler(async (req, res) => {
  res.json(await catalogService.listActiveGames());
});

export const listCategories = asyncHandler(async (req, res) => {
  res.json(await catalogService.listCategories(req.query.game as string));
});

export const listProducts = asyncHandler(async (req, res) => {
  res.json(
    await catalogService.listProducts({
      gameCode: req.query.game as string,
      categoryCode: req.query.category as string | undefined,
      productType: req.query.productType as string | undefined,
    }),
  );
});

export const listProductTypes = asyncHandler(async (req, res) => {
  res.json(
    await catalogService.listProductTypes({
      gameCode: req.query.game as string,
      categoryCode: req.query.category as string,
    }),
  );
});
