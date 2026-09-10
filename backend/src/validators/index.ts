/**
 * HTTP/request validators live here.
 * Keep transport validation out of services so business rules stay testable.
 */
export { parseLoginBody } from './auth.validator';
export {
  parseCreateCustomerBody,
  parseCreateFollowUpBody,
  parseCustomerListQuery,
  parseUpdateCustomerBody,
} from './customer.validator';
