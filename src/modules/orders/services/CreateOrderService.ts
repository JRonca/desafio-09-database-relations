import { inject, injectable } from 'tsyringe';

import AppError from '@shared/errors/AppError';

import IProductsRepository from '@modules/products/repositories/IProductsRepository';
import ICustomersRepository from '@modules/customers/repositories/ICustomersRepository';
import Order from '../infra/typeorm/entities/Order';
import IOrdersRepository from '../repositories/IOrdersRepository';

interface IProduct {
  id: string;
  quantity: number;
}

interface IRequest {
  customer_id: string;
  products: IProduct[];
}

@injectable()
class CreateOrderService {
  constructor(
    @inject('OrdersRepository')
    private ordersRepository: IOrdersRepository,

    @inject('ProductsRepository')
    private productsRepository: IProductsRepository,

    @inject('CustomersRepository')
    private customersRepository: ICustomersRepository,
  ) {}

  public async execute({ customer_id, products }: IRequest): Promise<Order> {
    const customer = await this.customersRepository.findById(customer_id);
    if (!customer) {
      throw new AppError('customer does not exists');
    }
    const existProducts = await this.productsRepository.findAllById(products);
    if (!existProducts.length) {
      throw new AppError('Could not find any products with the given id');
    }
    const existProductsIds = existProducts.map(product => product.id);

    const checkInexistentProducts = products.filter(
      product => !existProductsIds.includes(product.id),
    );
    if (checkInexistentProducts.length) {
      throw new AppError(
        `Could not find products ${checkInexistentProducts[0].id}`,
      );
    }
    const productsRequest = existProducts.map(product => {
      const varProduct = products.find(p => p.id === product.id);
      if (!varProduct) {
        throw new AppError(`Could not find products`);
      }
      if (varProduct.quantity > product.quantity) {
        throw new AppError('Quantity of product does not availibility!');
      }
      return {
        product_id: product.id,
        price: product.price,
        quantity: varProduct.quantity,
      };
    });

    const productsQuantityUpdate = await existProducts.map(product => {
      const varProduct = products.find(p => p.id === product.id);
      if (!varProduct) {
        throw new AppError(`Could not find products`);
      }
      return {
        id: product.id,
        quantity: product.quantity - varProduct.quantity,
      };
    });

    await this.productsRepository.updateQuantity(productsQuantityUpdate);

    const order = await this.ordersRepository.create({
      customer,
      products: productsRequest,
    });

    return order;
  }
}

export default CreateOrderService;
